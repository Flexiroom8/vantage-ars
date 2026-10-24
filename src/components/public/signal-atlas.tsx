export function SignalAtlas() {
  return (
    <svg
      className="signal-atlas"
      viewBox="0 0 900 760"
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
        <path d="M84 510H204C240 510 252 478 280 478H390" stroke="url(#atlas-wire)" />
        <path d="M390 478C425 478 439 438 474 438H568" stroke="url(#atlas-wire)" />
        <path d="M568 438H648C673 438 684 421 684 398V348" stroke="var(--color-accent)" />
        <path d="M208 510V584H299C334 584 344 552 378 552H475" stroke="var(--color-accent)" />
        <path d="M398 478V396H461C487 396 499 376 499 353V319" stroke="var(--color-accent)" />
        <path
          className="atlas-wire-trace"
          pathLength="1"
          d="M84 510H204C240 510 252 478 280 478H390C425 478 439 438 474 438H568"
        />
      </g>

      <g className="atlas-nodes">
        <circle cx="84" cy="510" r="7" />
        <circle cx="208" cy="510" r="5" />
        <circle cx="398" cy="478" r="8" />
        <circle cx="568" cy="438" r="5" />
        <circle cx="684" cy="348" r="7" />
        <circle cx="299" cy="584" r="5" />
        <circle cx="499" cy="319" r="5" />
        <circle cx="475" cy="552" r="4" />
      </g>

      <g className="atlas-node-halos">
        <circle cx="84" cy="510" r="16" />
        <circle cx="398" cy="478" r="20" />
        <circle cx="568" cy="438" r="16" />
      </g>

      <circle className="atlas-packet atlas-packet-one" r="4">
        <animateMotion
          dur="5.5s"
          repeatCount="indefinite"
          path="M84 510H204C240 510 252 478 280 478H390C425 478 439 438 474 438H568"
        />
      </circle>
      <circle className="atlas-packet atlas-packet-two" r="3">
        <animateMotion
          dur="6.4s"
          begin="-2.2s"
          repeatCount="indefinite"
          path="M568 438H648C673 438 684 421 684 398V348"
        />
      </circle>
      <circle className="atlas-packet atlas-packet-three" r="2.5">
        <animateMotion
          dur="4.7s"
          begin="-1.5s"
          repeatCount="indefinite"
          path="M208 510V584H299C334 584 344 552 378 552H475"
        />
      </circle>
    </svg>
  );
}
