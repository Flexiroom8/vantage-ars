import { useEffect, useRef, type ReactNode } from "react";

/**
 * The confirmation panel that replaces a form once it succeeds.
 *
 * Swapping the form out for a result unmounts the control that had focus, so
 * focus drops to `<body>` and a screen reader announces nothing — the visitor
 * is left staring at a green message they may never hear. This wrapper takes
 * focus on mount (so the outcome is announced and a keyboard user is not
 * stranded) and is marked as a status live region as a belt-and-braces measure.
 *
 * `autoFocus` should be false when the panel can also render without a submit
 * (for example an already-answered link opened fresh), so a page never steals
 * focus on load.
 */
export function FormConfirmation({
  children,
  className = "panel rounded-2xl p-6",
  autoFocus = true,
}: {
  children: ReactNode;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return (
    <div ref={ref} role="status" tabIndex={-1} className={className}>
      {children}
    </div>
  );
}
