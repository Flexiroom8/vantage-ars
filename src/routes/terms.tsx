import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/site/seo";
import { PublicFrame } from "@/components/public/site-frame";
import { QuoteIcon } from "@/components/public/motion-icons";

export const Route = createFileRoute("/terms")({
  head: () =>
    pageHead({
      title: "How work is agreed · Vantage-ARS",
      description:
        "A Vantage-ARS enquiry or chat is not a contract. Work starts from a written quote. Card payment is not available.",
      path: "/terms",
    }),
  component: TermsPage,
});

const RULES = [
  "An enquiry, chat, or service-desk message is not a contract and not a quote.",
  "Published labour is R690 per hour remote and R805 per hour on-site, unless the quote changes it.",
  "VAT is added only when the written quote says so.",
  "Travel, hardware, licences, and third-party services are extra and itemised before they are agreed.",
  "Monthly managed support is not offered. After-hours work is by appointment.",
  "Pay by EFT or international wire, using the reference on the quote or invoice. Card checkout is not available.",
] as const;

function TermsPage() {
  return (
    <PublicFrame>
      <article className="enter-up max-w-3xl py-16">
        <p className="flex items-center gap-2 font-mono text-xs tracking-[0.22em] text-accent uppercase">
          <QuoteIcon className="size-4" aria-hidden="true" />
          Before any work
        </p>
        <h1 className="mt-4 font-serif text-4xl tracking-[-0.03em] sm:text-6xl">How work is agreed</h1>
        <p className="mt-3 text-xs text-subtle">Last updated: October 2026.</p>

        <div className="panel mt-8 rounded-2xl p-6">
          <p className="text-sm leading-relaxed text-muted">
            Work starts only from a written quote that names the scope, timing, and total price. This keeps the job clear before any paid work begins.
          </p>
        </div>

        <ul className="mt-8 space-y-4 text-sm leading-relaxed text-muted">
          {RULES.map((rule) => (
            <li key={rule} className="flex gap-3 border-b border-border pb-4">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              <span>{rule}</span>
            </li>
          ))}
        </ul>

        <div className="relative mt-10 overflow-hidden rounded-2xl border border-border bg-surface p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-accent/10 blur-2xl"
          />
          <h2 className="font-serif text-3xl tracking-[-0.03em]">In plain English</h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
            You ask for help, we explain what is involved, and you see the price in writing before anyone starts. If it is not on the quote, it is not part of the agreed work.
          </p>
        </div>
      </article>
    </PublicFrame>
  );
}
