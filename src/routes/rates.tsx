import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/site/seo";
import { PublicFrame } from "@/components/public/site-frame";
import { RATE_GROUPS, ratesByIds } from "@/lib/office/catalogue";

export const Route = createFileRoute("/rates")({
  head: () => pageHead({ title: "Rates · Vantage-ARS", description: "Published Vantage-ARS rates in South African rand. A written quote confirms the total. Managed support is not offered.", path: "/rates" }),
  component: RatesPage,
});

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
      <p className="flex flex-wrap gap-6 border-t border-border py-16 text-sm">
        <Link to="/" hash="enquiry" className="text-accent underline-offset-4 hover:underline">
          Get a written quote
        </Link>
        <Link to="/" hash="payment" className="text-muted underline-offset-4 hover:text-fg hover:underline">
          How to pay
        </Link>
      </p>
    </PublicFrame>
  );
}
