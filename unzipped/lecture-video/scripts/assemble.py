#!/usr/bin/env python3
"""
Video assembly script for lecture-video skill.
Stitches clips, mixes audio layers, adds crossfades.

Usage:
    python3 assemble.py <project_dir>
    
Project directory structure expected:
    project_dir/
    ├── clips/          # Video clips in order: 001.mp4, 002.mp4, ...
    ├── voiceover/      # Audio segments: 001.mp3, 002.mp3, ... (or full.mp3)
    ├── music.mp3       # Background music (optional)
    ├── sfx/            # Sound effects: transition.mp3, reveal.mp3, etc.
    └── output/         # Final output goes here

Steps:
    1. Concat video clips with crossfade transitions
    2. Concat/align voiceover segments
    3. Mix audio layers (voice 100%, SFX 40%, music 15-20%)
    4. Merge video + mixed audio
    5. Export final.mp4
"""

import subprocess
import sys
import os
import glob
import json


def get_duration(filepath: str) -> float:
    """Get media file duration in seconds using ffprobe."""
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", filepath],
        capture_output=True, text=True
    )
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])


def concat_clips(clips_dir: str, output_path: str, crossfade_duration: float = 0.5):
    """Concatenate video clips with optional crossfade transitions."""
    clips = sorted(glob.glob(os.path.join(clips_dir, "*.mp4")))
    
    if not clips:
        print("No clips found!")
        sys.exit(1)
    
    if len(clips) == 1:
        subprocess.run(["cp", clips[0], output_path])
        return
    
    # Simple concat (crossfade adds complexity, use when < 10 clips)
    if len(clips) <= 10 and crossfade_duration > 0:
        _concat_with_crossfade(clips, output_path, crossfade_duration)
    else:
        _concat_simple(clips, output_path)


def _concat_simple(clips: list, output_path: str):
    """Simple concatenation without transitions."""
    concat_file = os.path.join(os.path.dirname(output_path), "concat_list.txt")
    with open(concat_file, 'w') as f:
        for clip in clips:
            f.write(f"file '{os.path.abspath(clip)}'\n")
    
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-c:v", "libx264", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        output_path
    ], check=True)
    os.remove(concat_file)


def _concat_with_crossfade(clips: list, output_path: str, fade_dur: float):
    """Concatenate with crossfade transitions between clips."""
    if len(clips) == 2:
        d0 = get_duration(clips[0])
        offset = d0 - fade_dur
        subprocess.run([
            "ffmpeg", "-y",
            "-i", clips[0], "-i", clips[1],
            "-filter_complex",
            f"[0:v][1:v]xfade=transition=fade:duration={fade_dur}:offset={offset}[v]",
            "-map", "[v]",
            "-c:v", "libx264", "-crf", "18",
            "-movflags", "+faststart",
            output_path
        ], check=True)
        return
    
    # For 3+ clips, chain xfade filters
    inputs = " ".join([f"-i {c}" for c in clips])
    n = len(clips)
    
    filter_parts = []
    durations = [get_duration(c) for c in clips]
    
    # Calculate offsets
    cumulative = 0
    offsets = []
    for i in range(n - 1):
        if i == 0:
            cumulative = durations[0] - fade_dur
        else:
            cumulative += durations[i] - fade_dur
        offsets.append(cumulative)
    
    # Build filter chain
    prev = "0:v"
    for i in range(1, n):
        curr_out = f"v{i}" if i < n - 1 else "v"
        filter_parts.append(
            f"[{prev}][{i}:v]xfade=transition=fade:duration={fade_dur}:offset={offsets[i-1]}[{curr_out}]"
        )
        prev = curr_out
    
    filter_complex = ";".join(filter_parts)
    
    cmd = ["ffmpeg", "-y"]
    for c in clips:
        cmd.extend(["-i", c])
    cmd.extend([
        "-filter_complex", filter_complex,
        "-map", "[v]",
        "-c:v", "libx264", "-crf", "18",
        "-movflags", "+faststart",
        output_path
    ])
    
    subprocess.run(cmd, check=True)


def concat_audio_segments(audio_dir: str, output_path: str):
    """Concatenate voiceover segments in order."""
    segments = sorted(glob.glob(os.path.join(audio_dir, "*.mp3")))
    
    if not segments:
        print("No audio segments found!")
        return None
    
    if len(segments) == 1:
        subprocess.run(["cp", segments[0], output_path])
        return output_path
    
    concat_file = os.path.join(os.path.dirname(output_path), "audio_concat.txt")
    with open(concat_file, 'w') as f:
        for seg in segments:
            f.write(f"file '{os.path.abspath(seg)}'\n")
    
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-c:a", "libmp3lame", "-b:a", "192k",
        output_path
    ], check=True)
    os.remove(concat_file)
    return output_path


def mix_audio(voice_path: str, music_path: str = None, sfx_paths: list = None,
              output_path: str = "mixed_audio.mp3",
              voice_vol: float = 1.0, music_vol: float = 0.15, sfx_vol: float = 0.4):
    """Mix audio layers: voiceover + music + SFX."""
    
    if not music_path and not sfx_paths:
        # Just voice, no mixing needed
        subprocess.run(["cp", voice_path, output_path])
        return
    
    inputs = ["-i", voice_path]
    filter_parts = []
    mix_inputs = []
    idx = 0
    
    # Voice
    filter_parts.append(f"[{idx}:a]volume={voice_vol}[voice]")
    mix_inputs.append("[voice]")
    idx += 1
    
    # Music (loop to match voice duration if needed)
    if music_path and os.path.exists(music_path):
        voice_dur = get_duration(voice_path)
        inputs.extend(["-stream_loop", "-1", "-i", music_path])
        # Fade music in/out
        filter_parts.append(
            f"[{idx}:a]volume={music_vol},afade=t=in:d=2,afade=t=out:st={voice_dur-3}:d=3,atrim=0:{voice_dur}[music]"
        )
        mix_inputs.append("[music]")
        idx += 1
    
    # SFX (concatenated or individual)
    if sfx_paths:
        for sfx in sfx_paths:
            if os.path.exists(sfx):
                inputs.extend(["-i", sfx])
                filter_parts.append(f"[{idx}:a]volume={sfx_vol}[sfx{idx}]")
                mix_inputs.append(f"[sfx{idx}]")
                idx += 1
    
    n_inputs = len(mix_inputs)
    filter_str = ";".join(filter_parts)
    
    if n_inputs > 1:
        mix_str = "".join(mix_inputs)
        filter_str += f";{mix_str}amix=inputs={n_inputs}:duration=longest:dropout_transition=3[out]"
        map_label = "[out]"
    else:
        map_label = "[voice]"
    
    cmd = ["ffmpeg", "-y"] + inputs + [
        "-filter_complex", filter_str,
        "-map", map_label,
        "-c:a", "libmp3lame", "-b:a", "192k",
        output_path
    ]
    
    subprocess.run(cmd, check=True)


def merge_video_audio(video_path: str, audio_path: str, output_path: str):
    """Merge video with mixed audio track."""
    subprocess.run([
        "ffmpeg", "-y",
        "-i", video_path,
        "-i", audio_path,
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        "-map", "0:v:0", "-map", "1:a:0",
        "-shortest",
        "-movflags", "+faststart",
        output_path
    ], check=True)


def assemble(project_dir: str):
    """Full assembly pipeline."""
    clips_dir = os.path.join(project_dir, "clips")
    voiceover_dir = os.path.join(project_dir, "voiceover")
    music_path = os.path.join(project_dir, "music.mp3")
    sfx_dir = os.path.join(project_dir, "sfx")
    output_dir = os.path.join(project_dir, "output")
    
    os.makedirs(output_dir, exist_ok=True)
    
    temp_video = os.path.join(output_dir, "temp_video.mp4")
    temp_voice = os.path.join(output_dir, "temp_voice.mp3")
    temp_mixed = os.path.join(output_dir, "temp_mixed.mp3")
    final_output = os.path.join(output_dir, "final.mp4")
    
    # Step 1: Concat video clips
    print("Step 1: Concatenating video clips...")
    concat_clips(clips_dir, temp_video)
    
    # Step 2: Concat voiceover segments
    print("Step 2: Concatenating voiceover...")
    # Check if there's a single full.mp3 or multiple segments
    full_voice = os.path.join(voiceover_dir, "full.mp3")
    if os.path.exists(full_voice):
        temp_voice = full_voice
    else:
        concat_audio_segments(voiceover_dir, temp_voice)
    
    # Step 3: Mix audio layers
    print("Step 3: Mixing audio layers...")
    sfx_paths = sorted(glob.glob(os.path.join(sfx_dir, "*.mp3"))) if os.path.exists(sfx_dir) else []
    music = music_path if os.path.exists(music_path) else None
    
    mix_audio(
        voice_path=temp_voice,
        music_path=music,
        sfx_paths=sfx_paths if sfx_paths else None,
        output_path=temp_mixed
    )
    
    # Step 4: Merge video + audio
    print("Step 4: Merging video and audio...")
    merge_video_audio(temp_video, temp_mixed, final_output)
    
    # Cleanup temp files
    for f in [temp_video, temp_mixed]:
        if os.path.exists(f) and f != full_voice:
            try:
                os.remove(f)
            except:
                pass
    if os.path.exists(temp_voice) and temp_voice != full_voice:
        try:
            os.remove(temp_voice)
        except:
            pass
    
    print(f"\nDone! Final video: {final_output}")
    print(f"Duration: {get_duration(final_output):.1f}s")
    return final_output


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 assemble.py <project_dir>")
        print("\nExpected structure:")
        print("  project_dir/clips/     - Video clips (001.mp4, 002.mp4, ...)")
        print("  project_dir/voiceover/ - Audio segments (001.mp3, ... or full.mp3)")
        print("  project_dir/music.mp3  - Background music (optional)")
        print("  project_dir/sfx/       - Sound effects (optional)")
        sys.exit(1)
    
    assemble(sys.argv[1])
