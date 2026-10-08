import { useEffect, useRef } from "react";

type Node = { x: number; y: number };
type Edge = [number, number];

export function LiveField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let nodes: Node[] = [];
    let edges: Edge[] = [];
    let raf = 0;
    let running = true;

    const layout = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = Math.max(4, Math.round(w / 190));
      const rows = Math.max(4, Math.round(h / 170));
      nodes = [];
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          nodes.push({
            x: ((c + 0.5) / cols) * w + Math.sin(c * 1.7 + r) * 16,
            y: ((r + 0.5) / rows) * h + Math.cos(r * 1.3 + c) * 12,
          });
        }
      }
      edges = [];
      for (let i = 0; i < nodes.length; i += 1) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        if (c + 1 < cols) edges.push([i, i + 1]);
        if (r + 1 < rows) edges.push([i, i + cols]);
      }
    };

    const draw = (time: number) => {
      if (!running) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(12, 92, 171, 0.22)";
      for (const [a, b] of edges) {
        const aNode = nodes[a];
        const bNode = nodes[b];
        if (!aNode || !bNode) continue;
        ctx.beginPath();
        ctx.moveTo(aNode.x, aNode.y);
        ctx.lineTo(bNode.x, bNode.y);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(12, 92, 171, 0.45)";
      for (const node of nodes) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduce) {
        for (let i = 0; i < 7; i += 1) {
          const edge = edges[(i * 5) % edges.length];
          if (!edge) continue;
          const [a, b] = edge;
          const aNode = nodes[a];
          const bNode = nodes[b];
          if (!aNode || !bNode) continue;
          const u = (time / 3200 + i / 7) % 1;
          const x = aNode.x + (bNode.x - aNode.x) * u;
          const y = aNode.y + (bNode.y - aNode.y) * u;
          ctx.beginPath();
          ctx.fillStyle = "rgba(12, 92, 171, 1)";
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        raf = requestAnimationFrame(draw);
      }
    };

    const start = () => {
      running = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    const onResize = () => {
      layout();
      if (reduce) draw(0);
    };
    const onHide = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else start();
    };

    layout();
    start();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />;
}

const STOPS = [
  { title: "The phone", detail: "No dial tone, one-way audio, or a handset that will not register." },
  { title: "The network", detail: "Wi-Fi, switches, and the route between the two ends." },
  { title: "The system", detail: "The phone system or server the call depends on." },
] as const;

export function PathExhibit() {
  return (
    <div className="mt-14 border-t border-border pt-8">
      <p className="text-sm text-accent">Most faults sit in one of three places</p>
      <div className="mt-6 overflow-hidden">
        <svg viewBox="0 0 720 72" className="hidden h-16 w-full text-accent sm:block" role="img" aria-label="A signal moving from the handset, across the network, to the system.">
          <line x1="16" y1="28" x2="704" y2="28" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
          {[16, 360, 704].map((x) => (
            <g key={x}>
              <circle cx={x} cy="28" r="7" fill="currentColor" />
            </g>
          ))}
          <circle r="4.5" className="signal-packet" fill="var(--color-fg)" />
        </svg>
        <ol className="grid gap-8 sm:grid-cols-3">
          {STOPS.map((stop) => (
            <li key={stop.title}>
              <h3 className="font-serif text-3xl">{stop.title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{stop.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
