export function PathArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 720 180"
      className={className}
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g stroke="var(--color-border)" strokeWidth="1" opacity="0.3">
        <path d="M160 20v140M360 20v140M560 20v140" strokeDasharray="2 10" />
        <path d="M20 132h680" />
      </g>
      <path d="M0 98h720" stroke="var(--color-accent)" strokeOpacity="0.06" strokeWidth="24" />
      <path
        d="M122 98h476"
        stroke="var(--color-accent)"
        strokeOpacity="0.3"
        strokeWidth="1.5"
        strokeDasharray="4 8"
      />
      <circle r="4" className="desk-packet" fill="var(--color-accent)" />
      <circle
        r="4"
        className="desk-packet desk-packet-2"
        fill="var(--color-accent)"
        opacity="0.75"
      />
      <circle r="3.5" className="desk-packet desk-packet-3" fill="var(--color-ok)" opacity="0.8" />

      <g strokeLinecap="round" strokeLinejoin="round">
        <ellipse
          cx="88"
          cy="132"
          rx="56"
          ry="7"
          fill="var(--color-fg)"
          opacity="0.05"
          stroke="none"
        />
        <path
          d="M62 100c0-14 8-25 18-30"
          stroke="var(--color-accent)"
          strokeOpacity="0.55"
          fill="none"
        />
        <path
          d="M52 106c0-20 11-37 26-45"
          stroke="var(--color-accent)"
          strokeOpacity="0.3"
          fill="none"
        />
        <path
          d="M58 67c9-5 17-7 26-7s17 2 26 7"
          stroke="var(--color-fg)"
          strokeWidth="6"
          fill="none"
        />
        <rect
          x="46"
          y="58"
          width="18"
          height="30"
          rx="8"
          fill="var(--color-surface)"
          stroke="var(--color-fg)"
          strokeWidth="1.5"
        />
        <rect
          x="104"
          y="58"
          width="18"
          height="30"
          rx="8"
          fill="var(--color-surface)"
          stroke="var(--color-fg)"
          strokeWidth="1.5"
        />
        <rect
          x="48"
          y="90"
          width="74"
          height="41"
          rx="9"
          fill="var(--color-raised)"
          stroke="var(--color-fg)"
          strokeWidth="1.5"
          strokeOpacity="0.75"
        />
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => (
            <circle
              key={`${row}-${col}`}
              cx={62 + col * 14}
              cy={101 + row * 10}
              r="2.5"
              fill="var(--color-border)"
              stroke="none"
            />
          )),
        )}
        <circle cx="106" cy="117" r="3" fill="var(--color-ok)" stroke="none" className="mi-blink" />
      </g>

      <g strokeLinecap="round" strokeLinejoin="round">
        <ellipse
          cx="360"
          cy="142"
          rx="66"
          ry="7"
          fill="var(--color-fg)"
          opacity="0.05"
          stroke="none"
        />
        <path
          d="M334 90V60M360 90V50M386 90V63"
          stroke="var(--color-fg)"
          strokeOpacity="0.7"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M323 53c-4-7-4-14 0-20M370 43c5-8 5-16 0-23M397 55c4-7 4-14 0-20"
          stroke="var(--color-accent)"
          strokeOpacity="0.6"
          strokeWidth="1.3"
          fill="none"
        />
        <path
          d="M324 90l13-9h73l-13 9z"
          fill="var(--color-raised)"
          stroke="var(--color-fg)"
          strokeOpacity="0.55"
          strokeWidth="1.2"
        />
        <rect
          x="324"
          y="90"
          width="73"
          height="42"
          rx="6"
          fill="var(--color-surface)"
          stroke="var(--color-fg)"
          strokeOpacity="0.75"
          strokeWidth="1.5"
        />
        <g fill="var(--color-raised)" stroke="var(--color-border)">
          {[0, 1, 2, 3].map((index) => (
            <rect key={index} x={334 + index * 13} y="104" width="8" height="7" rx="1" />
          ))}
        </g>
        <g stroke="none">
          <circle cx="338" cy="120" r="2" fill="var(--color-ok)" className="mi-blink" />
          <circle cx="346" cy="120" r="2" fill="var(--color-border)" />
          <circle cx="384" cy="120" r="2" fill="var(--color-accent)" />
        </g>
      </g>

      <g strokeLinecap="round" strokeLinejoin="round">
        <ellipse
          cx="642"
          cy="146"
          rx="54"
          ry="7"
          fill="var(--color-fg)"
          opacity="0.05"
          stroke="none"
        />
        <path
          d="M610 51c0-5 4-9 9-9h46c5 0 9 4 9 9v90h-64z"
          fill="var(--color-surface)"
          stroke="var(--color-fg)"
          strokeOpacity="0.75"
          strokeWidth="1.5"
        />
        <path d="M610 64h64M610 129h64" stroke="var(--color-border)" />
        {[0, 1, 2].map((row) => (
          <g key={row}>
            <rect
              x="619"
              y={70 + row * 20}
              width="46"
              height="14"
              rx="2"
              fill="var(--color-raised)"
              stroke="var(--color-border)"
            />
            <circle
              cx="655"
              cy={77 + row * 20}
              r="1.8"
              fill={row === 1 ? "var(--color-ok)" : "var(--color-border)"}
              stroke="none"
              className={row === 1 ? "mi-blink" : undefined}
            />
          </g>
        ))}
        <path
          d="M682 108c17 0 17 14 29 14"
          stroke="var(--color-subtle)"
          strokeWidth="1.2"
          fill="none"
        />
      </g>
    </svg>
  );
}
