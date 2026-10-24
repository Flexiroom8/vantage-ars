import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicFrame } from "@/components/public/site-frame";
import { SignalBars } from "@/components/public/motion-icons";
import { ServiceArt } from "@/components/public/service-art";
import { PUBLISHED_RATES } from "@/lib/office/catalogue";
import { SERVICE_PAGES } from "@/lib/site/services";
import { breadcrumbJsonLd, businessJsonLd, jsonLd, pageHead, SITE_URL } from "@/lib/site/seo";

export const Route = createFileRoute("/services/")({
  head: () => {
    const head = pageHead({
      title: "Service lines · Vantage-ARS",
      description:
        "Published service lines for VoIP, networking, IT infrastructure, managed support, cloud and email, security, backup recovery and AI workflow automation. Each engagement has a written scope and price basis.",
      path: "/services",
    });
    return {
      ...head,
      scripts: [
        businessJsonLd(),
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
        ]),
        jsonLd({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Vantage-ARS service lines",
          numberOfItems: SERVICE_PAGES.length,
          itemListElement: SERVICE_PAGES.map((page, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: page.title,
            url: `${SITE_URL}/services/${page.slug}`,
          })),
        }),
      ],
    };
  },
  component: ServicesPage,
});

function ServicesPage() {
  const offered = PUBLISHED_RATES.filter((rate) => rate.offered).length;

  return (
    <PublicFrame>
      <nav
        aria-label="Breadcrumb"
        className="pt-10 font-mono text-xs tracking-[0.14em] text-subtle uppercase"
      >
        <Link to="/" className="transition-colors hover:text-fg">
          Home
        </Link>{" "}
        / <span className="text-accent">Services</span>
      </nav>

      <section className="enter-up pb-12 pt-8 lg:pt-12">
        <p className="flex items-center gap-2 font-mono text-xs tracking-[0.22em] text-accent uppercase">
          <SignalBars className="size-4" aria-hidden="true" />
          Published service lines
        </p>
        <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-[0.98] tracking-[-0.03em] sm:text-7xl">
          Practical services, clearly scoped.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Each line has a written scope and clear boundaries. Rates are published where work has a
          standard basis; every project quote confirms the scope and total before it starts.
        </p>
        <p className="mt-4 font-mono text-xs text-subtle uppercase tracking-[0.16em]">
          {SERVICE_PAGES.length} service lines · {offered} published rates
        </p>
      </section>

      <section className="grid gap-4 border-t border-border py-10 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICE_PAGES.map((page) => (
          <Link
            key={page.slug}
            to="/services/$slug"
            params={{ slug: page.slug }}
            className="panel panel-hover group flex flex-col overflow-hidden rounded-2xl"
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-border bg-surface">
              <ServiceArt
                slug={page.slug}
                className="h-full w-full transition-transform duration-500 group-hover:scale-[1.025]"
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface to-transparent" />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <p className="font-mono text-xs text-accent">{page.number}</p>
              <h2 className="mt-2 font-serif text-3xl leading-tight group-hover:text-accent">
                {page.title}
              </h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{page.lead}</p>
              <span className="mt-5 font-mono text-xs text-subtle transition-colors group-hover:text-accent">
                Open the line →
              </span>
            </div>
          </Link>
        ))}
      </section>

      <section className="border-t border-border py-12">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface/50 p-6">
          <div>
            <h2 className="font-serif text-3xl">Not sure where it sits?</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              The finder asks three plain questions and names the closest published line, the guides
              that narrow it and what to include in the enquiry.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/find"
              className="cta inline-flex h-11 items-center rounded-md px-5 text-sm font-medium"
            >
              Find your starting point
            </Link>
            <Link
              to="/rates"
              className="cta-ghost inline-flex h-11 items-center rounded-md px-5 text-sm font-medium"
            >
              Published rates
            </Link>
          </div>
        </div>
      </section>
    </PublicFrame>
  );
}
