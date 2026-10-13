@import "tailwindcss";

@theme {
  --font-sans: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
  --font-serif: "Instrument Serif", ui-serif, Georgia, "Times New Roman", serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --color-bg: #f3f6fb;
  --color-surface: #ffffff;
  --color-raised: #e6eef8;
  --color-fg: #122033;
  --color-muted: #4d6078;
  --color-subtle: #7d8da3;
  --color-accent: #0c5cab;
  --color-accent-fg: #f7fbff;
  --color-border: #d5e0ee;
  --color-ring: #0c5cab;
  --color-ok: #0f7a4a;
  --color-warn: #9a6208;
  --color-danger: #b42318;

  --radius-xs: 0.25rem;
  --radius-sm: 0.375rem;
  --radius-md: 0.625rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;

  --shadow-border: 0 0 0 1px rgb(18 32 51 / 0.08);
  --shadow-border-hover: 0 0 0 1px rgb(18 32 51 / 0.16);
}

@layer base {
  html {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    scroll-behavior: smooth;
  }

  html,
  body,
  #app {
    min-height: 100%;
    background:
      radial-gradient(circle at top, rgba(12, 92, 171, 0.06), transparent 30%),
      var(--color-bg);
    color: var(--color-fg);
  }

  body {
    font-family: var(--font-sans);
    line-height: 1.5;
  }

  h1,
  h2,
  h3 {
    text-wrap: balance;
  }

  p {
    text-wrap: pretty;
  }

  a {
    text-decoration: none;
  }

  button:not(:disabled),
  [role="button"]:not(:disabled) {
    cursor: pointer;
  }

  :focus-visible {
    outline: 2px solid color-mix(in srgb, var(--color-accent) 65%, white);
    outline-offset: 3px;
  }

  ::selection {
    background: color-mix(in oklab, var(--color-accent) 35%, transparent);
    color: var(--color-fg);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

@keyframes enter-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse-live {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

.enter-up {
  animation: enter-up 400ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.live-dot {
  animation: pulse-live 2.2s ease-in-out infinite;
}

html:has(.site),
html:has(.site) body {
  background: #f3f6fb;
}

.site {
  --color-bg: #f3f6fb;
  --color-surface: #ffffff;
  --color-raised: #e6eef8;
  --color-fg: #122033;
  --color-muted: #4d6078;
  --color-subtle: #7d8da3;
  --color-accent: #0c5cab;
  --color-accent-fg: #f7fbff;
  --color-border: #d5e0ee;
  --color-ring: #0c5cab;
  --color-ok: #0f7a4a;
  --color-warn: #9a6208;
  --color-danger: #b42318;
  --shadow-border: 0 0 0 1px rgb(18 32 51 / 0.08);
  --shadow-border-hover: 0 0 0 1px rgb(18 32 51 / 0.16);
  background: transparent;
  color: var(--color-fg);
}

.site summary::-webkit-details-marker {
  display: none;
}

.signal-packet {
  offset-path: path("M 16 28 H 704");
  animation: signal-ride 7s linear infinite;
}

#services,
#prices,
#enquiry,
#payment {
  scroll-margin-top: 5.5rem;
}

@keyframes signal-ride {
  from {
    offset-distance: 0%;
  }
  to {
    offset-distance: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .signal-packet {
    animation: none;
    offset-distance: 50%;
  }
}
