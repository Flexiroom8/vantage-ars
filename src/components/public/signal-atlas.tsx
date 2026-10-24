export function SignalAtlas() {
  return (
    <svg
      className="signal-atlas"
      viewBox="0 0 600 450"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="atlas-wire" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.04" />
          <stop offset="0.5" stopColor="var(--color-accent)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0.75" />
        </linearGradient>
        <filter id="atlas-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g className="atlas-wires" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M58 328H177C208 328 210 281 241 281H338" stroke="url(#atlas-wire)" />
        <path d="M338 281C378 281 376 185 414 185H540" stroke="url(#atlas-wire)" />
        <path d="M338 281C381 281 382 356 422 356H530" stroke="var(--color-accent)" />
        <path d="M177 328V388H245" stroke="var(--color-accent)" />
        <path d="M414 185V114H476" stroke="var(--color-accent)" />
        <path
          className="atlas-wire-trace"
          pathLength="1"
          d="M58 328H177C208 328 210 281 241 281H338C378 281 376 185 414 185H540"
        />
      </g>

      <g className="atlas-nodes">
        <circle cx="58" cy="328" r="7" />
        <circle cx="177" cy="328" r="5" />
        <circle cx="338" cy="281" r="8" />
        <circle cx="414" cy="185" r="5" />
        <circle cx="540" cy="185" r="7" />
        <circle cx="422" cy="356" r="5" />
        <circle cx="245" cy="388" r="5" />
        <circle cx="476" cy="114" r="4" />
      </g>

      <g className="atlas-node-halos">
        <circle cx="58" cy="328" r="16" />
        <circle cx="338" cy="281" r="20" />
        <circle cx="540" cy="185" r="16" />
      </g>

      <circle className="atlas-packet atlas-packet-one" r="4">
        <animateMotion
          dur="5.5s"
          repeatCount="indefinite"
          path="M58 328H177C208 328 210 281 241 281H338C378 281 376 185 414 185H540"
        />
      </circle>
      <circle className="atlas-packet atlas-packet-two" r="3">
        <animateMotion
          dur="6.4s"
          begin="-2.2s"
          repeatCount="indefinite"
          path="M58 328H177C208 328 210 281 241 281H338C381 281 382 356 422 356H530"
        />
      </circle>
      <circle className="atlas-packet atlas-packet-three" r="2.5">
        <animateMotion dur="4.7s" begin="-1.5s" repeatCount="indefinite" path="M177 328V388H245" />
      </circle>
    </svg>
  );
}
