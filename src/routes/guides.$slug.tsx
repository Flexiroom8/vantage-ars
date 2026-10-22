import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PublicFrame } from "@/components/public/site-frame";
import { GUIDES, guideBySlug, type Guide } from "@/lib/site/guides";
import { servicePage } from "@/lib/site/services";
import {
  breadcrumbJsonLd,
  businessJsonLd,
  faqJsonLd,
  jsonLd,
  pageHead,
  SITE_URL,
} from "@/lib/site/seo";
import { COMPANY } from "@/lib/office/company";

export const Route = createFileRoute("/guides/$slug")({
  loader: ({ params }: { params: { slug: string } }): Guide => {
    const guide = guideBySlug(params.slug);
    if (!guide) throw notFound();
    return guide;
  },
  head: ({ loaderData }: { loaderData?: Guide }) => {
    if (!loaderData) return {};
    const head = pageHead({
      title: loaderData.metaTitle,
      description: loaderData.description,
      path: `/guides/${loaderData.slug}`,
      type: "article",
      authorName: COMPANY.authorName,
    });
    return {
      ...head,
      scripts: [
        businessJsonLd(),
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: loaderData.title, path: `/guides/${loaderData.slug}` },
        ]),
        jsonLd({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: loaderData.title,
          description: loaderData.description,
          datePublished: loaderData.updated,
          dateModified: loaderData.updated,
          author: { "@type": "Person", name: COMPANY.authorName },
          publisher: {
            "@type": "Organization",
            name: COMPANY.tradingName,
            url: SITE_URL,
          },
          mainEntityOfPage: `${SITE_URL}/guides/${loaderData.slug}`,
          articleSection: "Technical guide",
        }),
        ...(loaderData.faq ? [faqJsonLd([loaderData.faq])] : []),
      ],
    };
  },
  component: GuidePage,
});

function GuidePage() {
  const guide = Route.useLoaderData() as Guide;
  const related = guide.relatedServices
    .map((slug) => servicePage(slug))
    .filter((page): page is NonNullable<typeof page> => Boolean(page));
  const others = GUIDES.filter((item) => item.slug !== guide.slug).slice(0, 2);

  return (
    <PublicFrame>
      <nav
        aria-label="Breadcrumb"
        className="pt-10 font-mono text-xs tracking-[0.14em] text-subtle uppercase"
      >
        <Link to="/" className="transition-colors hover:text-fg">
          Home
        </Link>{" "}
        /{" "}
        <Link to="/guides" className="transition-colors hover:text-fg">
          Guides
        </Link>{" "}
        / <span className="text-accent">{guide.title}</span>
      </nav>

      <article className="enter-up pb-12 pt-8">
        <header className="border-b border-border pb-10">
          <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">Field note</p>
          <h1 className="mt-4 max-w-4xl font-serif text-5xl leading-[0.98] tracking-[-0.03em] sm:text-7xl">
            {guide.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">{guide.summary}</p>
          <p className="mt-4 flex flex-wrap items-center gap-3 font-mono text-[10px] tracking-[0.16em] text-subtle uppercase">
            <span>{guide.readingMinutes} min read</span>
            <span aria-hidden="true">·</span>
            <span>
              Updated{" "}
              <time dateTime={guide.updated}>
                {new Intl.DateTimeFormat("en-ZA", {
                  dateStyle: "long",
                  timeZone: "UTC",
                }).format(new Date(guide.updated))}
              </time>
            </span>
          </p>
        </header>

        <div className="mx-auto mt-10 grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-10">
            {guide.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="font-serif text-3xl tracking-[-0.02em]">{section.heading}</h2>
                <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {section.bullets ? (
                  <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}

            {guide.faq ? (
              <section className="rounded-2xl border border-border bg-surface/60 p-6">
                <h2 className="font-serif text-2xl">{guide.faq.q}</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted">{guide.faq.a}</p>
              </section>
            ) : null}

            <section className="rounded-2xl border border-border bg-surface/60 p-6">
              <p className="font-mono text-[10px] tracking-[0.18em] text-accent uppercase">
                The boundary
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                This guide is general information. It is not a diagnosis of your system and it does
                not create an obligation to restore, fix or respond within a particular time. Work
                begins from a written quote with the scope, price and checks agreed first.
              </p>
              <Link
                to="/"
                hash="enquiry"
                className="cta mt-5 inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
              >
                Ask for a written quote
              </Link>
            </section>
          </div>

          <aside className="space-y-6">
            {related.length ? (
              <div className="rounded-2xl border border-border p-5">
                <p className="font-mono text-[10px] tracking-[0.18em] text-subtle uppercase">
                  Related services
                </p>
                <ul className="mt-3 space-y-3">
                  {related.map((page) => (
                    <li key={page.slug}>
                      <Link
                        to="/services/$slug"
                        params={{ slug: page.slug }}
                        className="text-sm font-medium text-fg underline-offset-4 hover:text-accent hover:underline"
                      >
                        {page.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded-2xl border border-border p-5">
              <p className="font-mono text-[10px] tracking-[0.18em] text-subtle uppercase">
                More field notes
              </p>
              <ul className="mt-3 space-y-4">
                {others.map((item) => (
                  <li key={item.slug}>
                    <Link
                      to="/guides/$slug"
                      params={{ slug: item.slug }}
                      className="text-sm leading-snug text-fg underline-offset-4 hover:text-accent hover:underline"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                to="/guides"
                className="mt-4 inline-flex text-xs text-accent underline-offset-4 hover:underline"
              >
                All guides
              </Link>
            </div>
          </aside>
        </div>
      </article>
    </PublicFrame>
  );
}
