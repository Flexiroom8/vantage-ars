import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/site/seo";
import { PublicFrame } from "@/components/public/site-frame";
import { SERVICE_LINES, ratesByIds } from "@/lib/office/catalogue";

export const Route = createFileRoute("/work")({
  head: () => pageHead({ title: "The work · Vantage-ARS", description: "VoIP, networking, and IT infrastructure work from Vantage-ARS. Scope is confirmed in a written quote.", path: "/work" }),
  component: WorkPage,
});

const DETAIL = [
  {
    ids: ["voip-diagnosis", "pbx-design", "pbx-install"],
    limit: "Carrier access, number porting, handsets, and licences are third-party. They are listed before they are agreed.",
  },
  {
    ids: ["network-setup", "network-point", "survey"],
    limit: "Cable, hardware, ceiling work, and travel are not inside a small-job estimate. They are quoted on their own.",
  },
  {
    ids: ["infra-assessment", "infra-change"],
    limit: "Penetration testing and compliance certification are not part of an assessment. A change includes rollback and acceptance steps.",
  },
] as const;

const WORK_VALUES = [
  "Clear scope before work starts",
  "Written quote and pricing first",
  "No monthly lock-in or retainer",
] as const;

function WorkPage() {
  return (
    <PublicFrame>
      <article className="enter-up pb-8 pt-16 lg:pt-24">
        <p className="text-sm text-accent">The work</p>
        <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-[0.96] tracking-[-0.04em] sm:text-7xl">
          Phones, networks, and the systems behind them.
        </h1>
        <p className="mt-8 max-w-xl text-lg text-muted">
          Tell us what is failing. The quote names the work, the time, and the price. You do not join a monthly plan to get help.
        </p>
      </article>

      <section className="grid gap-4 border-y border-border bg-surface/80 p-4 md:grid-cols-3 md:p-6">
        {WORK_VALUES.map((value) => (
          <div key={value} className="rounded-xl border border-border bg-bg p-4 text-sm text-muted shadow-[var(--shadow-border)]">
            {value}
          </div>
        ))}
      </section>

      {SERVICE_LINES.map((line, index) => {
        const detail = DETAIL[index];
        const rates = ratesByIds(detail.ids);
        return (
          <section key={line.number} className="border-t border-border py-16">
            <p className="font-mono text-sm text-accent">{line.number}</p>
            <h2 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">{line.title}</h2>
            <p className="mt-4 max-w-xl text-muted">{line.summary}</p>
            <ul className="mt-10 border-t border-fg/20">
              {rates.map((rate) => (
                <li key={rate.id} className="grid gap-2 border-b border-fg/15 py-5 sm:grid-cols-[1fr_9rem]">
                  <div>
                    <h3 className="font-medium">{rate.title}</h3>
                    <p className="mt-1 text-sm text-muted">{rate.scope}</p>
                  </div>
                  <p className="font-mono text-sm sm:text-right">{rate.price}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-2xl text-sm text-muted">{detail.limit}</p>
          </section>
        );
      })}

      <div className="border-t border-border py-16">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-border)]">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">No surprises</p>
          <h2 className="mt-3 font-serif text-4xl tracking-[-0.03em]">The scope is fixed in the quote before work starts.</h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            Hardware, travel, licences, and third-party services are separated and explained in writing so the work remains predictable.
          </p>
          <Link to="/" hash="enquiry" className="mt-6 inline-flex items-center text-sm font-medium text-accent underline-offset-4 hover:underline">
            Get a written quote
          </Link>
        </div>
      </div>
    </PublicFrame>
  );
}
