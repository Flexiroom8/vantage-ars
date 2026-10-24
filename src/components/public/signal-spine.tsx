import { useEffect, useState } from "react";

type SignalLayout = {
  width: number;
  height: number;
  paths: string[];
  nodes: Array<{ x: number; y: number }>;
  motionPath: string;
};

const EMPTY_LAYOUT: SignalLayout = {
  width: 0,
  height: 0,
  paths: [],
  nodes: [],
  motionPath: "",
};

function buildLayout(main: HTMLElement): SignalLayout {
  const bounds = main.getBoundingClientRect();
  const width = main.clientWidth;
  const height = main.scrollHeight;
  const railX = width < 640 ? 7 : 11;
  const sections = Array.from(
    main.querySelectorAll<HTMLElement>(":scope > section, :scope > article"),
  );
  const anchors = sections
    .map((section) => {
      const heading = section.querySelector<HTMLElement>("h1, h2, h3");
      if (!heading) return null;
      const rect = heading.getBoundingClientRect();
      return {
        section,
        x: Math.max(railX + 28, Math.min(width - 12, rect.left - bounds.left - 10)),
        y: Math.max(0, rect.top - bounds.top + rect.height * 0.52),
      };
    })
    .filter((anchor): anchor is NonNullable<typeof anchor> => anchor !== null)
    .sort((a, b) => a.y - b.y);

  if (anchors.length < 2) return { width, height, paths: [], nodes: [], motionPath: "" };

  const firstY = Math.max(12, anchors[0].y - 30);
  const lastY = Math.min(height - 8, anchors.at(-1)!.y + 30);
  const paths = [`M ${railX} ${firstY} V ${lastY}`];
  const nodes: SignalLayout["nodes"] = [{ x: railX, y: firstY }];
  for (const anchor of anchors) {
    paths.push(
      `M ${railX} ${anchor.y} C ${railX + 16} ${anchor.y}, ${anchor.x - 22} ${anchor.y}, ${anchor.x} ${anchor.y}`,
    );
    nodes.push({ x: railX, y: anchor.y }, { x: anchor.x, y: anchor.y });

    const nested = Array.from(
      anchor.section.querySelectorAll<HTMLElement>(
        ".home-quick-path, .panel, figure, form, [data-signal-node]",
      ),
    )
      .filter((element) => !element.closest("[data-signal-ignore]"))
      .slice(0, 8);
    if (nested.length < 2) continue;

    const cardPoints = nested
      .map((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        return {
          x: Math.max(railX + 26, Math.min(width - 10, rect.left - bounds.left + 3)),
          y: Math.max(anchor.y + 14, rect.top - bounds.top + Math.min(rect.height * 0.25, 38)),
        };
      })
      .filter((point): point is { x: number; y: number } => point !== null)
      .sort((a, b) => a.y - b.y);

    if (cardPoints.length < 2) continue;
    const childRailX = railX + 9;
    paths.push(`M ${childRailX} ${cardPoints[0].y} V ${cardPoints.at(-1)!.y}`);
    nodes.push({ x: childRailX, y: cardPoints[0].y });
    for (const point of cardPoints) {
      paths.push(
        `M ${childRailX} ${point.y} C ${childRailX + 12} ${point.y}, ${point.x - 18} ${point.y}, ${point.x} ${point.y}`,
      );
      nodes.push({ x: point.x, y: point.y });
    }
  }

  return {
    width,
    height,
    paths,
    nodes,
    motionPath: `M ${railX} ${firstY} V ${lastY}`,
  };
}

/** Connects the real page sections and their cards using their rendered positions. */
export function SignalSpine() {
  const [layout, setLayout] = useState(EMPTY_LAYOUT);

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setLayout(buildLayout(main)));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    for (const element of main.querySelectorAll<HTMLElement>(
      "section, article, .panel, figure, form",
    )) {
      observer.observe(element);
    }
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  if (!layout.motionPath || layout.height <= 0) return null;

  return (
    <svg
      className="site-signal-spine"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <g className="site-signal-tracks">
        {layout.paths.map((path, index) => (
          <path key={index} d={path} />
        ))}
      </g>
      <g className="site-signal-nodes">
        {layout.nodes.map((node, index) => (
          <circle key={index} cx={node.x} cy={node.y} r={index % 3 === 0 ? 3.2 : 2} />
        ))}
      </g>
      <circle className="site-signal-packet" r="3.2">
        <animateMotion dur="22s" repeatCount="indefinite" path={layout.motionPath} />
      </circle>
    </svg>
  );
}
