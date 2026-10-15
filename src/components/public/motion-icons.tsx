/**
 * Animated icons for the public site. Every icon uses currentColor and the
 * .mi-* animation utilities from styles.css, and every one of them holds a
 * still pose when prefers-reduced-motion is set (the utilities neutralise
 * themselves).
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function IconBase({ title, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** VoIP: handset with expanding signal rings. */
export function VoipIcon({ title, className, ...props }: IconProps) {
  return (
    <IconBase title={title} className={className} {...props}>
      <path d="M5.2 4.5h3l1.2 3.4-1.9 1.4a10.5 10.5 0 0 0 5.2 5.2l1.4-1.9 3.4 1.2v3a1.6 1.6 0 0 1-1.7 1.6A13.4 13.4 0 0 1 3.6 6.2 1.6 1.6 0 0 1 5.2 4.5Z" />
      <g stroke="var(--color-accent)">
        <circle className="mi-ring" cx="17.5" cy="6.5" r="3.2" opacity="0.7" />
        <circle className="mi-ring mi-ring-2" cx="17.5" cy="6.5" r="3.2" opacity="0.7" />
        <circle className="mi-ring mi-ring-3" cx="17.5" cy="6.5" r="3.2" opacity="0.7" />
        <circle cx="17.5" cy="6.5" r="1.1" fill="var(--color-accent)" stroke="none" />
      </g>
    </IconBase>
  );
}

/** Networking: mesh of nodes with a packet travelling the top link. */
export function NetworkIcon({ title, className, ...props }: IconProps) {
  return (
    <IconBase title={title} className={className} {...props}>
      <path d="M6 7.5 12 4l6 3.5-6 3.5-6-3.5Z" />
      <path d="M6 7.5v5L12 16l6-3.5v-5" />
      <path d="M12 11v5" />
      <g fill="var(--color-accent)" stroke="none">
        <circle className="mi-ping" cx="6" cy="7.5" r="2.6" opacity="0.35" />
        <circle cx="6" cy="7.5" r="1.4" />
        <circle cx="18" cy="7.5" r="1.4" />
        <circle cx="12" cy="16" r="1.4" />
        <circle className="mi-slide" cx="6" cy="7.5" r="1.3" />
      </g>
    </IconBase>
  );
}

/** IT infrastructure: a server rack with blinking lights and activity bars. */
export function InfraIcon({ title, className, ...props }: IconProps) {
  return (
    <IconBase title={title} className={className} {...props}>
      <rect x="3.5" y="4" width="11" height="16" rx="1.8" />
      <path d="M3.5 9h11" />
      <path d="M3.5 15h11" />
      <g fill="var(--color-accent)" stroke="none">
        <circle className="mi-blink" cx="6.4" cy="6.5" r="0.9" />
        <circle className="mi-blink mi-blink-2" cx="6.4" cy="12.5" r="0.9" />
        <circle className="mi-blink mi-blink-3" cx="6.4" cy="18.5" r="0.9" />
      </g>
      <g stroke="var(--color-accent)" strokeWidth={2.4}>
        <path className="mi-bar" d="M18.5 16v3" />
        <path className="mi-bar mi-bar-2" d="M20.75 12v7" />
      </g>
    </IconBase>
  );
}

/** Signal strength bars, for status strips. */
export function SignalBars({ title, className, ...props }: IconProps) {
  return (
    <IconBase title={title} className={className} {...props}>
      <g stroke="var(--color-accent)" strokeWidth={2.6} strokeLinecap="round">
        <path className="mi-bar" d="M4 18v-4" />
        <path className="mi-bar mi-bar-2" d="M9.3 18V9" />
        <path className="mi-bar mi-bar-3" d="M14.7 18V6" />
        <path className="mi-bar mi-bar-4" d="M20 18V3.5" />
      </g>
    </IconBase>
  );
}

/** Live node with a pulsing halo, for status pills. */
export function LiveNode({ title, className, ...props }: IconProps) {
  return (
    <IconBase title={title} className={className} {...props}>
      <circle className="mi-ping" cx="12" cy="12" r="7" stroke="var(--color-ok)" opacity="0.6" />
      <circle cx="12" cy="12" r="4" fill="var(--color-ok)" stroke="none" />
    </IconBase>
  );
}

/** Written quote: a document with a scanning confirm line. */
export function QuoteIcon({ title, className, ...props }: IconProps) {
  return (
    <IconBase title={title} className={className} {...props}>
      <path d="M6 3.5h8L19 8.5V20.5H6Z" />
      <path d="M13.5 3.5V9H19" />
      <path d="M9 13h7" />
      <path d="M9 17h4" />
      <path className="mi-scan" d="M8.5 11.5h8" stroke="var(--color-accent)" strokeWidth={2.2} />
    </IconBase>
  );
}

/** Worldwide reach: globe with a ping on the equator. */
export function GlobeIcon({ title, className, ...props }: IconProps) {
  return (
    <IconBase title={title} className={className} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.2-3.6-8.5s1.2-6.2 3.6-8.5Z" />
      <circle className="mi-ping" cx="12" cy="12" r="3" stroke="var(--color-accent)" />
    </IconBase>
  );
}

/** No-retainer handshake-free mark: a simple crossed-out chain-free loop. */
export function NoTiesIcon({ title, className, ...props }: IconProps) {
  return (
    <IconBase title={title} className={className} {...props}>
      <path d="M8 12a4 4 0 0 1 4-4h1.5a3.5 3.5 0 0 1 0 7H13" />
      <path d="M16 12a4 4 0 0 1-4 4h-1.5a3.5 3.5 0 0 1 0-7H11" />
      <path d="M4.5 4.5l15 15" stroke="var(--color-accent)" />
    </IconBase>
  );
}
