import { FAULT_STOPS } from "@/lib/site/fault-path";
import { PathArt } from "@/components/public/path-art";

/** A quiet static atmosphere in place of the animated network canvas. */
export function LiveField() {
  return <div aria-hidden="true" className="ambient-field pointer-events-none fixed inset-0 z-0" />;
}

// Titles come from the shared fault path so the hero teaser and the full
// interactive finder below can never drift. Only the titles are repeated here —
// the detail lines live in SignalPath, which is the authoritative breakdown.
const STOPS = FAULT_STOPS;

export function PathExhibit() {
  return (
    <div className="mt-14 border-t border-border pt-8">
      {/* Heading, not a paragraph: without an h2 here the stop titles below
          render as h3s before the page's first h2 (invalid outline order). */}
      <h2 className="text-sm font-normal text-accent">Most faults sit in one of three places</h2>
      <div className="mt-6 overflow-hidden">
        <PathArt className="h-auto w-full" />
        <ol className="mt-5 grid gap-8 sm:grid-cols-3">
          {STOPS.map((stop) => (
            <li key={stop.title}>
              <h3 className="font-serif text-3xl">{stop.title}</h3>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
