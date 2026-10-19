import { useId } from "react";

export function WatchtowerMark({
  className,
  title = "Vantage-ARS",
}: {
  className?: string;
  title?: string;
}) {
  // The mark renders more than once per page (header and footer), so a static
  // gradient id would produce duplicate ids in the document — invalid HTML and
  // an `axe` duplicate-id failure. Derive one per instance instead.
  const gradientId = `wm-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#7ec8ff" />
          <stop offset="100%" stopColor="#0c5cab" />
        </linearGradient>
      </defs>
      <title>{title}</title>
      <rect x="4" y="4" width="4" height="16" fill={`url(#${gradientId})`} rx="1" />
      <rect x="16" y="4" width="4" height="16" fill={`url(#${gradientId})`} rx="1" />
      <rect x="4" y="4" width="16" height="4" fill={`url(#${gradientId})`} rx="1" />
      <circle className="mi-ping" cx="12" cy="2.6" r="2.2" fill="#7ec8ff" opacity="0.8" />
    </svg>
  );
}
