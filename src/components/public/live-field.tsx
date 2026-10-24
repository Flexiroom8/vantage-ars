import { useEffect, useRef } from "react";
import { FAULT_STOPS } from "@/lib/site/fault-path";
import { PathArt } from "@/components/public/path-art";

type Node = { x: number; y: number; vx: number; vy: number };
type Edge = [number, number];

const NODE_DENSITY = 1 / 15000; // one node per ~15,000 px²
const LINK_DIST = 170;
const PACKETS = 14;
const MAX_NODES = 110;

function readVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = styles.getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * The live background: a slow mesh of drifting nodes with packets riding the
 * links. Pure canvas, pauses when the tab is hidden, and renders one still
 * frame when the visitor prefers reduced motion.
 */
export function LiveField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const host = document.querySelector<HTMLElement>(".site") ?? document.documentElement;
    const styles = getComputedStyle(host);
    const lineColor = readVar(styles, "--mesh-line", "rgba(76,194,255,0.16)");
    const nodeColor = readVar(styles, "--mesh-node", "rgba(76,194,255,0.5)");
    const packetColor = readVar(styles, "--mesh-packet", "rgba(76,194,255,0.95)");

    let nodes: Node[] = [];
    let edges: Edge[] = [];
    let raf = 0;
    let running = true;
    let lastEdge = 0;

    const layout = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const total = Math.min(MAX_NODES, Math.max(28, Math.round(w * h * NODE_DENSITY)));
      nodes = [];
      for (let i = 0; i < total; i += 1) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18,
        });
      }
      lastEdge = 0;
    };

    const step = (dt: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      for (const n of nodes) {
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        if (n.x < -20 || n.x > w + 20) n.vx *= -1;
        if (n.y < -20 || n.y > h + 20) n.vy *= -1;
        n.x = Math.min(w + 20, Math.max(-20, n.x));
        n.y = Math.min(h + 20, Math.max(-20, n.y));
      }
    };

    const buildEdges = () => {
      edges = [];
      for (let i = 0; i < nodes.length; i += 1) {
        let links = 0;
        for (let j = i + 1; j < nodes.length; j += 1) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          if (dx * dx + dy * dy < LINK_DIST * LINK_DIST) {
            edges.push([i, j]);
            links += 1;
            if (links >= 4) break;
          }
        }
      }
    };

    const draw = (time: number) => {
      if (!running) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      ctx.lineWidth = 1;
      ctx.strokeStyle = lineColor;
      ctx.beginPath();
      for (const [a, b] of edges) {
        ctx.moveTo(nodes[a].x, nodes[a].y);
        ctx.lineTo(nodes[b].x, nodes[b].y);
      }
      ctx.stroke();

      ctx.fillStyle = nodeColor;
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduce && edges.length > 0) {
        for (let i = 0; i < PACKETS; i += 1) {
          const edge = edges[Math.floor((i * 2654435761) % edges.length)];
          if (!edge) continue;
          const [a, b] = edge;
          const t = (time / 2600 + i / PACKETS) % 1;
          const x = nodes[a].x + (nodes[b].x - nodes[a].x) * t;
          const y = nodes[a].y + (nodes[b].y - nodes[a].y) * t;
          const glow = ctx.createRadialGradient(x, y, 0, x, y, 7);
          glow.addColorStop(0, packetColor);
          glow.addColorStop(1, "rgba(76,194,255,0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = packetColor;
          ctx.beginPath();
          ctx.arc(x, y, 1.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!reduce) {
        step(1);
        if (time - lastEdge > 240) {
          buildEdges();
          lastEdge = time;
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
      buildEdges();
      if (reduce) draw(0);
    };
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else start();
    };

    layout();
    buildEdges();
    start();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />;
}

// Titles come from the shared fault path so the hero teaser and the full
// interactive finder below can never drift. Only the titles are repeated here —
// the detail lines live in SignalPath, which is the authoritative breakdown.
const STOPS = FAULT_STOPS;

export function PathExhibit() {
  return (
    <div className="mt-14 border-t border-border pt-8">
      {/* Heading, not a paragraph: without an h2 here the stop titles below
          render as h3s before the page's first h2 (invalid outline order). */}
      <h2 className="text-sm font-normal text-accent">Most faults sit in one of three places</h2>
      <div className="mt-6 overflow-hidden">
        <PathArt className="h-auto w-full" />
        <ol className="mt-5 grid gap-8 sm:grid-cols-3">
          {STOPS.map((stop) => (
            <li key={stop.title}>
              <h3 className="font-serif text-3xl">{stop.title}</h3>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
