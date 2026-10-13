import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/site/seo";
import { PublicFrame } from "@/components/public/site-frame";
import { RATE_GROUPS, ratesByIds } from "@/lib/office/catalogue";

export const Route = createFileRoute("/rates")({
  head: () =>
    pageHead({
      title: "Rates · Vantage-ARS",
      description:
        "Published Vantage-ARS rates in South African rand. A written quote confirms the total. Managed support is not offered.",
      path: "/rates",
    }),
  component: RatesPage,
});

const KEY_FACTS = [
  { label: "Remote labour", value: "R690/hr" },
  { label: "On-site labour", value: "R805/hr" },
  { label: "VAT policy", value: "Quote decides" },
] as const;

function RatesPage() {
  return (
    <PublicFrame>
      <article className="enter-up pb-8 pt-16 lg:pt-24">
        <p className="text-sm text-accent">Published rates</p>
        <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-[0.96] tracking-[-0.04em] sm:text-7xl">
          See the price before you say yes.
        </h1>
        <p className="mt-8 max-w-xl text-lg text-muted">
          Remote help starts at R690 an hour. On-site help starts at R805 an hour. Both are in South African rand. VAT is added only when the written quote says so.
        </p>
      </article>

      <section className="mb-8 grid gap-4 border-y border-border bg-surface/80 p-4 md:grid-cols-3 md:p-6">
        {KEY_FACTS.map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-bg p-4 shadow-[var(--shadow-border)]">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-subtle">{item.label}</p>
            <p className="mt-3 font-serif text-3xl tracking-[-0.03em] text-fg">{item.value}</p>
          </div>
        ))}
      </section>

      {RATE_GROUPS.map((group) => (
        <section key={group.title} className="border-t border-border py-16">
          <div className="grid gap-8 lg:grid-cols-[16rem_1fr] lg:gap-16">
            <div>
              <h2 className="font-serif text-4xl tracking-[-0.03em]">{group.title}</h2>
              <p className="mt-4 text-sm text-muted">{group.note}</p>
            </div>
            <ul className="border-t border-fg/20">
              {ratesByIds(group.ids).map((rate) => (
                <li key={rate.id} className="grid gap-2 border-b border-fg/15 py-6 sm:grid-cols-[1fr_10rem]">
                  <div>
                    <h3 className="font-medium">{rate.title}</h3>
                    <p className="mt-1 text-sm text-muted">{rate.scope}</p>
                    <p className="mt-2 text-sm text-subtle">{rate.basis}</p>
                  </div>
                  <p className="font-mono text-sm sm:text-right">{rate.offered ? rate.price : "Not offered"}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <section className="border-t border-border py-16">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-border)]">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">No hidden surprises</p>
            <h2 className="mt-3 font-serif text-4xl tracking-[-0.03em]">If it is not in the quote, it is not in the price.</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
              Hosted PBX, SIP trunk, call usage, handset purchases, number porting, travel, build work, hardware, and vendor fees are separated and explained before they are agreed.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link to="/" hash="enquiry" className="inline-flex h-11 items-center rounded-md bg-accent px-5 font-medium text-accent-fg">
              Get a quote
            </Link>
            <Link to="/" hash="payment" className="inline-flex h-11 items-center rounded-md border border-border px-5 text-fg shadow-[var(--shadow-border)]">
              How to pay
            </Link>
          </div>
        </div>
      </section>
    </PublicFrame>
  );
}
