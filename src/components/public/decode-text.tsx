import { useEffect, useRef, useState } from "react";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\<>*#·";

/**
 * Scrambles through random glyphs before settling on the final text —
 * a terminal-boot flavoured reveal. With reduced motion it shows the
 * final text immediately.
 */
export function DecodeText({
  text,
  className,
  speed = 18,
}: {
  text: string;
  className?: string;
  speed?: number;
}) {
  // Read prefers-reduced-motion inside the effect, never during render: the
  // server cannot answer the query, so computing it at render time made the
  // client disagree with the server (and mismatch) for reduced-motion visitors.
  const [shown, setShown] = useState("");
  const frame = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(text);
      return;
    }
    let alive = true;
    let step = 0;
    const total = Math.ceil(text.length * 1.25);

    const tick = () => {
      if (!alive) return;
      const settled = Math.min(text.length, Math.floor(step / 1.25));
      let out = "";
      for (let i = 0; i < text.length; i += 1) {
        if (i < settled || text[i] === " ") out += text[i];
        else out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setShown(out);
      step += 1;
      if (step <= total) frame.current = window.setTimeout(tick, speed);
      else setShown(text);
    };

    frame.current = window.setTimeout(tick, speed);
    return () => {
      alive = false;
      window.clearTimeout(frame.current);
    };
  }, [text, speed]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden={shown === text ? undefined : true}>{shown || "\u00a0"}</span>
    </span>
  );
}
