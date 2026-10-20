import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead, businessJsonLd } from "../lib/site/seo";
import { PublicFrame } from "@/components/public/site-frame";
import { InfraIcon, QuoteIcon, SignalBars } from "@/components/public/motion-icons";
import { SERVICE_PAGES } from "../lib/site/services";

export const Route = createFileRoute("/work")({
  head: () => {
    const head = pageHead({
      title: "Selected work · Vantage-ARS",
      description:
        "How Vantage-ARS works: diagnose remotely first, quote in writing, configure and test. Remote worldwide, on-site by arrangement.",
      path: "/work",
    });

    return {
      ...head,
      scripts: [businessJsonLd()],
    };
  },
  component: WorkPage,
});

const STEPS = [
  {
    title: "Diagnose remotely first",
    body: "Endpoint and network symptoms plus the call-path information you can provide. Many faults are narrowed down without a site visit.",
    Icon: SignalBars,
  },
  {
    title: "Quote in writing",
    body: "Scope, hours, travel and VAT treatment fixed on the quote. Nothing starts until you accept it.",
    Icon: QuoteIcon,
  },
  {
    title: "Configure and test",
    body: "Approved systems are configured and tested against agreed checks, with a short completion note.",
    Icon: InfraIcon,
  },
] as const;

function WorkPage() {
  return (
    <PublicFrame>
      <section className="enter-up pb-16 pt-16 lg:pt-24">
        <p className="font-mono text-xs tracking-[0.22em] text-accent uppercase">How work runs</p>
        <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-[0.98] tracking-[-0.03em] sm:text-7xl">
          Remote first. Quoted first. Tested after.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Every job follows the same path: understand the fault, fix the price in writing, then do
          the agreed work. Monthly managed plans are offered at a fixed published price, and there
          is still no live monitoring of your estate, no uptime promise and no contractual service
          level — just defined work with a way to check it.
        </p>
      </section>

      <section className="grid gap-4 border-t border-border py-12 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <div
            key={step.title}
            className={`panel panel-hover rounded-2xl p-6 ${index === 1 ? "enter-up d-1" : index === 2 ? "enter-up d-2" : "enter-up"}`}
          >
            <div className="flex items-center justify-between">
              <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-raised">
                <step.Icon className="size-6 text-accent" aria-hidden="true" />
              </span>
              <p className="font-mono text-sm text-subtle">{String(index + 1).padStart(2, "0")}</p>
            </div>
            <h2 className="mt-4 font-serif text-2xl">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
          </div>
        ))}
      </section>

      <section className="border-t border-border py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-serif text-4xl tracking-[-0.03em] sm:text-5xl">Where this applies</h2>
          <p className="font-mono text-xs tracking-[0.18em] text-subtle uppercase">
            Four lines of work
          </p>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          Managed services run monthly or as a one-off written report. Everything on the managed
          side is remote only, fixed in price, and produced from our own records.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICE_PAGES.map((page) => (
            <Link
              key={page.slug}
              to="/services/$slug"
              params={{ slug: page.slug }}
              className="panel panel-hover rounded-xl p-6"
            >
              <p className="font-mono text-xs text-accent">{page.number}</p>
              <p className="mt-2 font-serif text-2xl">{page.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{page.lead.slice(0, 120)}…</p>
            </Link>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/"
            hash="enquiry"
            className="cta inline-flex h-11 items-center rounded-md px-5 text-sm font-medium"
          >
            Request a quote
          </Link>
          <Link
            to="/rates"
            className="cta-ghost inline-flex h-11 items-center rounded-md px-5 text-sm font-medium"
          >
            See rates
          </Link>
        </div>
      </section>
    </PublicFrame>
  );
}
