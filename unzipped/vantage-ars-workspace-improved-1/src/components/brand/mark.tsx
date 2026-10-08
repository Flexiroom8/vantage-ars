export function WatchtowerMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <rect x="3" y="3" width="3" height="11" fill="currentColor" />
      <rect x="10" y="3" width="3" height="11" fill="currentColor" />
      <rect x="3" y="3" width="10" height="3" fill="currentColor" />
    </svg>
  );
}
