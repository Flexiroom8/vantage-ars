import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/site/seo";
import { PublicFrame } from "@/components/public/site-frame";
import { SERVICE_PAGES } from "@/lib/site/services";

export const Route = createFileRoute("/work")({
  head: () =>
    pageHead({
      title: "Selected work · Vantage-ARS",
      description:
        "How Vantage-ARS works: diagnose remotely first, quote in writing, configure and test. Remote worldwide, on-site by arrangement.",
      path: "/work",
    }),
  component: WorkPage,
});

const STEPS = [
  {
    title: "Diagnose remotely first",
    body: "Endpoint and network symptoms plus the call-path information you can provide. Many faults are narrowed down without a site visit.",
  },
  {
    title: "Quote in writing",
    body: "Scope, hours, travel and VAT treatment fixed on the quote. Nothing starts until you accept it.",
  },
  {
    title: "Configure and test",
    body: "Approved systems are configured and tested against agreed checks, with a short completion note.",
  },
] as const;

function WorkPage() {
  return (
    <PublicFrame>
      <section className="enter-up pb-16 pt-16 lg:pt-24">
        <p className="text-sm text-accent">How work runs</p>
        <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-[0.96] tracking-[-0.04em] sm:text-6xl">
          Remote first. Quoted first. Tested after.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          Every job follows the same path: understand the fault, fix the price in writing, then
          do the agreed work. No retainer, no SLA promise — just defined work with a way to check
          it.
        </p>
      </section>

      <section className="grid gap-4 border-t border-border py-12 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <div
            key={step.title}
            className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-border)]"
          >
            <p className="font-mono text-sm text-accent">{String(index + 1).padStart(2, "0")}</p>
            <h2 className="mt-2 font-serif text-2xl">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
          </div>
        ))}
      </section>

      <section className="border-t border-border py-16">
        <h2 className="font-serif text-4xl tracking-[-0.03em]">Where this applies</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {SERVICE_PAGES.map((page) => (
            <Link
              key={page.slug}
              to="/services/$slug"
              params={{ slug: page.slug }}
              className="rounded-xl p-6 shadow-[var(--shadow-border)] hover:bg-raised"
            >
              <p className="font-mono text-xs text-accent">{page.number}</p>
              <p className="mt-2 font-serif text-2xl">{page.title}</p>
              <p className="mt-1 text-sm text-muted">{page.lead.slice(0, 120)}…</p>
            </Link>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/"
            hash="enquiry"
            className="inline-flex h-11 items-center rounded-md bg-accent px-5 text-sm font-medium text-accent-fg"
          >
            Request a quote
          </Link>
          <Link
            to="/rates"
            className="inline-flex h-11 items-center rounded-md px-5 text-sm shadow-[var(--shadow-border)]"
          >
            See rates
          </Link>
        </div>
      </section>
    </PublicFrame>
  );
}
