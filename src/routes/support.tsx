import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PublicFrame } from "@/components/public/site-frame";
import { ratesByIds } from "@/lib/office/catalogue";
import { SERVICE_PAGES, servicePage } from "@/lib/site/services";
import { businessJsonLd, faqJsonLd, jsonLd, pageHead, SITE_URL } from "@/lib/site/seo";

export const Route = createFileRoute("/services/$slug")({
  loader: ({ params }) => {
    const page = servicePage(params.slug);
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const head = pageHead({ title: loaderData.metaTitle, description: loaderData.description, path: `/services/${loaderData.slug}` });
    return {
      ...head,
      scripts: [
        businessJsonLd(),
        faqJsonLd(loaderData.faqs),
        jsonLd({
          "@context": "https://schema.org",
          "@type": "Service",
          name: loaderData.title,
          serviceType: loaderData.title,
          description: loaderData.description,
          provider: { "@type": "ProfessionalService", name: "Vantage-ARS", url: SITE_URL },
          areaServed: "Worldwide (remote); on-site by arrangement",
          url: `${SITE_URL}/services/${loaderData.slug}`,
        }),
      ],
    };
  },
  component: ServicePageView,
});

function ServicePageView() {
  const page = Route.useLoaderData();
  const rates = ratesByIds(page.rateIds);
  const others = SERVICE_PAGES.filter((item) => item.slug !== page.slug);

  return (
    <PublicFrame>
      <nav aria-label="Breadcrumb" className="pt-10 text-sm text-muted">
        <Link to="/" className="hover:text-fg">
          Home
        </Link>{" "}
        /{" "}
        <Link to="/" hash="services" className="hover:text-fg">
          Services
        </Link>{" "}
        / <span className="text-fg">{page.title}</span>
      </nav>

      <section className="enter-up pb-16 pt-8 lg:pt-12">
        <p className="font-mono text-sm text-accent">{page.number}</p>
        <h1 className="mt-3 max-w-4xl font-serif text-5xl leading-[0.96] tracking-[-0.04em] sm:text-7xl">{page.title}</h1>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted">{page.lead}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/" hash="enquiry" className="inline-flex h-11 items-center rounded-md bg-accent px-5 text-sm font-medium text-accent-fg">
            Get a written quote
          </Link>
          <Link to="/support" className="inline-flex h-11 items-center rounded-md px-5 text-sm shadow-[var(--shadow-border)]">
            Already a customer? Service desk
          </Link>
        </div>
      </section>

      <section className="grid gap-4 border-y border-border bg-surface/80 p-4 md:grid-cols-3 md:p-6" aria-label="Service value summary">
        {[
          "Scope explained before work starts",
          "Quote-first pricing with no retainer",
          "Remote first, on-site only when needed",
        ].map((item) => (
          <div key={item} className="rounded-xl border border-border bg-bg p-4 text-sm text-muted shadow-[var(--shadow-border)]">
            {item}
          </div>
        ))}
      </section>

      <section className="border-t border-border py-16" aria-labelledby="symptoms-heading">
        <div className="grid gap-8 lg:grid-cols-[16rem_1fr] lg:gap-16">
          <h2 id="symptoms-heading" className="font-serif text-3xl tracking-[-0.03em] sm:text-4xl">
            Sound familiar?
          </h2>
          <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
            {page.symptoms.map((item) => (
              <li key={item} className="flex gap-3 border-b border-fg/10 pb-4 text-sm">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-border py-16" aria-labelledby="approach-heading">
        <h2 id="approach-heading" className="font-serif text-3xl tracking-[-0.03em] sm:text-4xl">
          How the work runs
        </h2>
        <ol className="mt-10 grid gap-10 md:grid-cols-3">
          {page.approach.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-border)]">
              <p className="font-mono text-sm text-accent">{String(index + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 font-serif text-2xl">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-border py-16" aria-labelledby="price-heading">
        <div className="grid gap-8 lg:grid-cols-[16rem_1fr] lg:gap-16">
          <div>
            <h2 id="price-heading" className="font-serif text-3xl tracking-[-0.03em] sm:text-4xl">
              Prices
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              South African rand. VAT is added only if the written quote says so.{" "}
              <Link to="/rates" className="text-fg underline-offset-4 hover:underline">
                Full rate sheet
              </Link>
              .
            </p>
          </div>
          <ul className="border-t border-fg/20">
            {rates.map((rate) => (
              <li key={rate.id} className="grid gap-2 border-b border-fg/15 py-5 sm:grid-cols-[1fr_9rem] sm:gap-8">
                <div>
                  <h3 className="text-base font-medium">{rate.title}</h3>
                  <p className="mt-1 text-sm text-muted">{rate.scope}</p>
                  <p className="mt-2 text-sm text-subtle">{rate.basis}</p>
                </div>
                <p className="font-mono text-sm sm:text-right">{rate.price}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-border py-16" aria-labelledby="excluded-heading">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 id="excluded-heading" className="font-serif text-3xl tracking-[-0.03em]">
              Not in the labour rate
            </h2>
            <ul className="mt-6 space-y-3 text-sm text-muted">
              {page.excluded.map((item) => (
                <li key={item} className="border-b border-fg/10 pb-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-serif text-3xl tracking-[-0.03em]">Questions</h2>
            <dl className="mt-6 space-y-6">
              {page.faqs.map((item) => (
                <div key={item.q}>
                  <dt className="text-sm font-medium">{item.q}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="border-t border-border py-16">
        <div className="rounded-2xl bg-[#0e1c33] p-8 text-white sm:p-12">
          <h2 className="max-w-2xl font-serif text-4xl tracking-[-0.03em]">Tell us what stopped.</h2>
          <p className="mt-4 max-w-xl text-sm text-white/70">
            A few sentences are enough. You get a written quote before anyone starts, and asking does not commit you to anything.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/" hash="enquiry" className="inline-flex h-11 items-center rounded-md bg-white px-5 text-sm font-medium text-[#0e1c33]">
              Request a quote
            </Link>
            <Link to="/support" className="inline-flex h-11 items-center rounded-md border border-white/20 px-5 text-sm font-medium text-white/90">
              Service desk
            </Link>
          </div>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {others.map((item) => (
            <Link
              key={item.slug}
              to="/services/$slug"
              params={{ slug: item.slug }}
              className="group rounded-xl p-6 shadow-[var(--shadow-border)] hover:bg-raised"
            >
              <p className="font-mono text-xs text-accent">{item.number}</p>
              <p className="mt-2 font-serif text-2xl group-hover:underline">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </PublicFrame>
  );
}
