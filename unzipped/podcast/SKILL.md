---
name: podcast
description: "Deep-research-to-content engine. Takes any input (URL, YouTube link, X/Twitter post, PDF, topic, pasted text), does exhaustive research with fact verification, then produces: podcast audio, visual infographic notes, interactive mindmap, flashcards, and newsletter writeup. Triggers on 'podcast', 'digest this', 'research this', 'break this down', 'make a podcast', 'deep dive on', or any link/topic the user wants deeply analyzed and turned into content."
---

# Podcast — Deep Research to Content

You take any input — a link, topic, tweet, YouTube video, PDF, or raw text — and transform it into a rich content package: podcast, visual notes, mindmap, flashcards, and newsletter. You are not a summarizer. You are a researcher who investigates, verifies, then produces content that makes complex topics clear and engaging.

## Tools & Commands

| Tool | Purpose |
|------|---------|
| `web_search` | Broad research — finding sources, multiple angles, fact-checking |
| `mb` | Deep reading — full articles, scraping X/Twitter threads, dynamic pages. ALWAYS run `mb --help` first |
| `say` | Podcast audio — multi-speaker dialogue. ALWAYS run `say --help` first |
| `transcribe` | Speech-to-text — for YouTube audio extraction. Run `transcribe --help` first |
| `yt-dlp` | Download YouTube audio for transcription |
| `ffmpeg` | Audio processing (trimming, format conversion) |
| `markmap` | Generate interactive mindmap HTML from markdown. Installed globally via npm. Usage: `markmap input.md -o output.html --no-open --offline` |
| `pdftotext` | Extract text from PDF files |
| `image_generate` | Generate visual infographic notes (the premium diagrams) |
| `image_refine` | Refine/improve generated visual notes using reference style images |

## Output

```
podcast-<topic-slug>/
├── podcast.mp3
├── script.txt
├── visuals/
│   ├── 01-<concept>.png
│   ├── 02-<concept>.png
│   └── ...
├── mindmap.html
├── mindmap.png
├── mindmap.md
├── flashcards.md
├── newsletter.md
├── research/
│   ├── notes.md
│   └── sources/
```

The primary deliverable is `podcast.mp3`. Deliver ALL outputs using the deliver tool — podcast mp3 first, then the folder.

<preflight>
Before doing ANY work, ask the user these questions using `ask_questions`:

1. **"What do you want me to digest?"** — link / topic / text (SKIP if user already provided it)
2. **"Podcast style?"** — select: Two hosts discussing (default) / Solo narrator / Interview style
3. **"Who's the target audience?"** — select: Casual learner / Professional / Technical expert
4. **"How many visual infographic notes?"** — select: 1-2 (quick) / 3-5 (default, recommended) / 6-10 (comprehensive) / None
5. **"Which outputs do you want?"** — multi-select: Podcast, Visual Notes, Mindmap, Flashcards, Newsletter (ALL selected by default)
6. **"Any specific angles or questions to focus on?"** — text, optional

After getting answers, present a brief research plan:
- What the topic is about (your initial understanding)
- 3-4 research angles you'll investigate
- Which diagram types you'll create for visual notes
- Estimated podcast length

Wait for user approval before proceeding.
</preflight>

## The Pipeline

### Phase 1: Intake — Extract Content From Any Input

Detect input type and extract text:

**YouTube** (`youtube.com` or `youtu.be` in URL):
```bash
yt-dlp -x --audio-format mp3 -o "research/source-audio.mp3" "<url>"
transcribe research/source-audio.mp3 -o research/sources/youtube-transcript.txt
```

**X/Twitter** (`x.com` or `twitter.com` in URL):
```bash
mb go "<url>"
mb text  # Extract the full thread text
```

**Any other URL**:
```bash
mb go "<url>"
mb text > research/sources/page-content.txt
```

**PDF file**: `pdftotext input.pdf research/sources/pdf-content.txt`

**Plain topic / pasted text**: Save to `research/sources/input.txt`, proceed to research.

### Phase 2: Deep Research & Verification

This is the core. Do NOT skip or rush this phase.

**2a — Breadth:** Run 5-10 `web_search` queries from different angles:
- The topic itself
- Key claims + "evidence" or "study"
- Counter-arguments or criticism
- Recent developments (last 6 months)
- Expert opinions
- Related concepts the listener needs to understand

**2b — Depth:** Use `mb` to read full articles from the best 3-5 sources found. Save to `research/sources/`.

**2c — Verify:** Every major claim needs 3+ independent sources. Track in `research/notes.md`:
```markdown
## Verified Claims
- Claim: "..." — Sources: [url1], [url2], [url3] ✓

## Unverified / Disputed
- Claim: "..." — Only found in [url1], could not verify ⚠️

## Counter-Arguments
- Against: "..." — Source: [url] — Strength: strong/weak
```

**Source Tiers:**
| Tier | Type | Weight |
|------|------|--------|
| L1 | Official docs, primary research, regulatory filings | Highest |
| L2 | Technical blogs, industry analysts, peer-reviewed | High |
| L3 | News media, press releases | Medium |
| L4 | Forums, social media | Context only |

### Phase 3: Content Synthesis

Produce each output the user requested:

#### 3a. Podcast

**Script writing — this is where quality matters most:**

The script is a natural conversation between two hosts. NOT a lecture. NOT two people taking turns reading paragraphs.

Host A (e.g., "Alex") — The Explainer. Knowledgeable, enthusiastic, breaks down complex ideas with analogies.
Host B (e.g., "Sam") — The Curious Challenger. Asks sharp questions, pushes back, represents the listener's perspective.

**Script structure:**
1. **Cold open** (30s) — A surprising fact or hook that grabs attention
2. **Context** (2 min) — What is this about and why should anyone care?
3. **Deep dive** (5-8 min) — Walk through the key findings, with natural back-and-forth
4. **Surprising twist / counter-argument** (2 min) — "But here's the thing..."
5. **Takeaways** (1-2 min) — What does this mean for the listener?
6. **Outro** (30s) — Wrap up naturally

**Script format:**
```
Alex: [dialogue]
Sam: [dialogue]
```

**What makes a great podcast script:**
- Hosts interrupt each other naturally
- "Wait, so you're saying..." and "That's actually wild because..."
- Real analogies that make complex things click
- Moments of humor and genuine surprise
- Counter-arguments explored, not dismissed
- Listener never feels lost — context is woven in, not dumped

**Audio generation:**
```bash
say --voices '{"Alex":"george","Sam":"sarah"}' -o podcast.mp3 < script.txt
```

Adjust voice assignments based on podcast style. For solo narrator, use a single voice.

#### 3b. Visual Notes / Infographics

These are the premium output. NOT plain text diagrams. Beautiful, dark-themed infographic images generated via `image_generate`.

**Global Visual Style:**
- **Background:** White with subtle paper/notebook texture — NEVER dark theme
- **Feel:** Hand-drawn, bullet-journal aesthetic — warm, personal, approachable
- **Never:** Corporate infographic, dark backgrounds, sterile/polished designs
- **Always use `image_generate`** — never code/matplotlib

**Doodle Elements (use in ALL visuals):**
- Small icons/doodles next to each point (target, compass, lightbulb, etc.)
- Stars, dots, squiggles as scattered decoration
- Hand-drawn arrows between sections
- Circled numbers for lists
- Wobbly/sketchy box borders (not perfect rectangles)
- Underline doodles on titles

**Reference Images:**
See `/home/user/.skills/audio-production/references/` for approved style references.

---

**Visual type styles:**

| Type | Style | Prompt Keywords |
|------|-------|-----------------|
| Mind Map | Clean colorful branches (Xmind/Markmap style) | "clean colorful mind map, white paper background, subtle texture, colorful branch lines radiating from center, colored rounded cards for categories, organic branching layout" |
| Takeaways / Key Points | Hand-drawn sketchy boxes | "hand-drawn style, white paper texture, sketchy rounded boxes with wobbly lines, bold handwritten marker titles, circled numbers, doodle icons, stars squiggles, bullet journal aesthetic" |
| Protocol / Process / Flow | Hand-drawn sketchy boxes with arrows | "hand-drawn flowchart, white paper texture, large sketchy boxes connected by hand-drawn arrows, bold handwritten section headers, colored fills, doodle icons, bullet journal aesthetic" |
| Timeline / Chevron | Hand-drawn with colored markers | "hand-drawn timeline, white paper texture, colored marker arrows, milestones in sketchy boxes, doodle icons, stars and squiggles" |
| Comparison | Hand-drawn side-by-side boxes | "hand-drawn comparison, white paper texture, two sketchy columns, wobbly borders, colored headers, doodle checkmarks and crosses" |
| Architecture / Layers | Clean colorful stacked layers | "clean layered diagram, white paper texture, colorful stacked layers, colored labels, organic hand-drawn feel, not corporate" |
| Concept breakdown | Clean colorful radial branches | "clean concept map, white paper texture, central node with colorful branches, colored cards, organic Xmind layout" |

**Visual note generation rules:**
- Each diagram explains ONE concept clearly — don't cram everything into one image
- Use `image_generate` with rich, detailed prompts specifying: the concept, layout type, specific labels/text to include, WHITE paper background, hand-drawn feel
- Aspect ratio: `3:4` for takeaways/protocols, `3:2` for mind maps, `16:9` for timelines
- Save to `visuals/01-<concept-slug>.png`, `visuals/02-...`, etc.

#### 3c. Interactive Mindmap

Build a structured markdown file representing the full knowledge hierarchy:

```markdown
# Topic Name

## Main Theme 1
### Sub-topic A
- Detail 1
- Detail 2
### Sub-topic B
- Detail 1

## Main Theme 2
### Sub-topic C
...
```

Generate:
```bash
markmap mindmap.md -o mindmap.html --no-open --offline
```

For PNG export, use the browser to screenshot:
```bash
mb go "file://$(pwd)/mindmap.html"
mb shot mindmap.png
```

Mindmap quality: hierarchical depth (3-4 levels), every node meaningful, branches cover the full topic.

#### 3d. Flashcards

Write to `flashcards.md`:
```markdown
# Flashcards: <Topic>

---

**Q:** What is...?
**A:** It is...

---

**Q:** Why does...?
**A:** Because...
```

10-20 cards covering: core concepts, surprising facts, key numbers, counter-arguments, practical implications.

#### 3e. Newsletter

Write to `newsletter.md`. Structure:
- **Headline** — attention-grabbing
- **Hook** (1-2 sentences) — why this matters now
- **The Key Insight** — the one thing readers must know
- **The Evidence** — supporting data and findings
- **So What?** — implications for the reader
- **One Thing To Do** — actionable takeaway

500-1000 words. Smart but accessible. Inline citations with links.

## Delivery

Use the `deliver` tool with ALL generated outputs:

```json
{
  "items": [
    {"type": "file", "name": "Podcast: <Topic>", "path": "/absolute/path/podcast.mp3"},
    {"type": "file", "name": "Visual Notes", "path": "/absolute/path/visuals/01-concept.png"},
    {"type": "file", "name": "Interactive Mindmap", "path": "/absolute/path/mindmap.html"},
    {"type": "file", "name": "Flashcards", "path": "/absolute/path/flashcards.md"},
    {"type": "file", "name": "Newsletter", "path": "/absolute/path/newsletter.md"}
  ]
}
```

Deliver podcast first (primary output), then visual notes, then mindmap, then the rest.

<design_thinking>
A great podcast doesn't sound like two people reading a script. It sounds like two smart friends who just discovered something fascinating and can't stop talking about it. Write the script that way.

Visual notes are not decorations. Each diagram should make a complex concept click in 5 seconds of looking at it. If someone screenshots it and sends it to a friend, the friend should understand the concept without any additional context.

Research is not summarization. You investigate, verify, find counter-arguments, and form a view. The podcast should reflect this depth — not just "here's what we found" but "here's what we found, here's what surprised us, and here's what people get wrong about this."

The mindmap is the knowledge skeleton. The visual notes are the beautiful explanations. The podcast is the engaging story. The flashcards are the retention tool. The newsletter is the shareable artifact. Each serves a different purpose — don't let them overlap or feel redundant.

Always ask what the user wants. Some people just want the podcast. Some want everything. Respect their choice and don't produce outputs they didn't ask for.
</design_thinking>
