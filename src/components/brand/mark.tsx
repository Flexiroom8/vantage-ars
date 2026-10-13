export function WatchtowerMark({ className, title = "Vantage-ARS" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#7ec8ff" />
          <stop offset="100%" stopColor="#0c5cab" />
        </linearGradient>
      </defs>
      <title>{title}</title>
      <rect x="4" y="4" width="4" height="16" fill="url(#g1)" rx="1" />
      <rect x="16" y="4" width="4" height="16" fill="url(#g1)" rx="1" />
      <rect x="4" y="4" width="16" height="4" fill="url(#g1)" rx="1" />
    </svg>
  );
}
