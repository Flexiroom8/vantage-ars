import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicFrame } from "@/components/public/site-frame";
import { SignalBars } from "@/components/public/motion-icons";
import { Badge } from "@/components/ui/badge";
import {
  FINDER_HORIZONS,
  FINDER_IMPACTS,
  FINDER_TOPICS,
  recommendService,
  type FinderHorizon,
  type FinderImpact,
  type FinderOption,
  type FinderTopic,
} from "@/lib/site/finder";
import { guideBySlug } from "@/lib/site/guides";
import { servicePage } from "@/lib/site/services";
import { breadcrumbJsonLd, businessJsonLd, pageHead } from "@/lib/site/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/find")({
  head: () => {
    const head = pageHead({
      title: "Find your service · Vantage-ARS",
      description:
        "Answer three questions about the symptom, its impact and whether you want a one-off fix or ongoing cover. Get the closest published service line, the guides that narrow it, and what to include in an enquiry.",
      path: "/find",
    });
    return {
      ...head,
      scripts: [
        businessJsonLd(),
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Find your service", path: "/find" },
        ]),
      ],
    };
  },
  component: FindPage,
});

function FindPage() {
  const [topic, setTopic] = useState<FinderTopic | null>(null);
  const [impact, setImpact] = useState<FinderImpact | null>(null);
  const [horizon, setHorizon] = useState<FinderHorizon | null>(null);

  const recommendation =
    topic && impact && horizon ? recommendService({ topic, impact, horizon }) : null;
  const primary = recommendation ? servicePage(recommendation.primarySlug) : null;
  const secondary = recommendation?.secondarySlug
    ? servicePage(recommendation.secondarySlug)
    : null;
  const guides = (recommendation?.guideSlugs ?? [])
    .map((slug) => guideBySlug(slug))
    .filter((guide): guide is NonNullable<typeof guide> => Boolean(guide));

  function reset() {
    setTopic(null);
    setImpact(null);
    setHorizon(null);
  }

  return (
    <PublicFrame>
      <nav
        aria-label="Breadcrumb"
        className="pt-10 font-mono text-xs tracking-[0.14em] text-subtle uppercase"
      >
        <Link to="/" className="transition-colors hover:text-fg">
          Home
        </Link>{" "}
        / <span className="text-accent">Find your service</span>
      </nav>

      <section className="enter-up pb-10 pt-8 lg:pt-12">
        <p className="flex items-center gap-2 font-mono text-xs tracking-[0.22em] text-accent uppercase">
          <SignalBars className="size-4" aria-hidden="true" />
          Starting point
        </p>
        <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-[0.98] tracking-[-0.03em] sm:text-7xl">
          Describe the symptom. Get a starting point.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Three questions place the problem on the published service lines and show the guides that
          narrow it. This is not a diagnosis, a price or a promise about the outcome. A written
          quote still comes first.
        </p>
      </section>

      <div className="grid gap-8 border-t border-border py-10 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="space-y-8">
          <ChoiceGroup
            legend="1. What needs attention?"
            name="finder-topic"
            options={FINDER_TOPICS}
            value={topic}
            onChange={setTopic}
            columns={2}
          />
          <ChoiceGroup
            legend="2. How is it affecting the business?"
            name="finder-impact"
            options={FINDER_IMPACTS}
            value={impact}
            onChange={setImpact}
            columns={3}
          />
          <ChoiceGroup
            legend="3. What kind of help are you looking for?"
            name="finder-horizon"
            options={FINDER_HORIZONS}
            value={horizon}
            onChange={setHorizon}
            columns={3}
          />
        </div>

        <aside aria-label="Your starting point" className="lg:sticky lg:top-24 lg:self-start">
          {recommendation && primary ? (
            <div aria-live="polite" className="panel rounded-2xl p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] tracking-[0.18em] text-accent uppercase">
                  Starting point
                </p>
                <Badge variant={recommendation.urgency === "now" ? "warn" : "accent"}>
                  {impactLabel(recommendation.urgency)}
                </Badge>
              </div>
              <h2 className="mt-4 font-serif text-3xl leading-tight">{recommendation.headline}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">{recommendation.rationale}</p>

              <div className="mt-5 flex flex-col gap-2">
                <Link
                  to="/services/$slug"
                  params={{ slug: primary.slug }}
                  className="cta inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium"
                >
                  Open {primary.title}
                </Link>
                {secondary ? (
                  <Link
                    to="/services/$slug"
                    params={{ slug: secondary.slug }}
                    className="cta-ghost inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium"
                  >
                    Also consider {secondary.title}
                  </Link>
                ) : null}
              </div>

              {guides.length > 0 ? (
                <div className="mt-6 border-t border-border pt-4">
                  <p className="font-mono text-[10px] tracking-[0.18em] text-subtle uppercase">
                    Guides that narrow it
                  </p>
                  <ul className="mt-3 space-y-3">
                    {guides.map((guide) => (
                      <li key={guide.slug}>
                        <Link
                          to="/guides/$slug"
                          params={{ slug: guide.slug }}
                          className="text-sm font-medium text-fg underline-offset-4 hover:text-accent hover:underline"
                        >
                          {guide.title}
                        </Link>
                        <p className="mt-1 text-xs leading-relaxed text-muted">{guide.summary}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-6 border-t border-border pt-4">
                <p className="font-mono text-[10px] tracking-[0.18em] text-subtle uppercase">
                  Put this in the enquiry
                </p>
                <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
                  {recommendation.checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <Link
                to="/"
                hash="enquiry"
                className="cta mt-5 inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold"
              >
                Ask for a written quote
              </Link>

              <button
                type="button"
                onClick={reset}
                className="mt-3 inline-flex w-full items-center justify-center text-xs text-subtle underline-offset-4 hover:text-fg hover:underline"
              >
                Start again
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface/60 p-6">
              <p className="font-mono text-[10px] tracking-[0.18em] text-subtle uppercase">
                Waiting for three answers
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Choose the symptom, what it is doing to the business, and whether you want a one-off
                job or ongoing cover. The result names a published service line and two guides, and
                gives you a checklist for the enquiry.
              </p>
              <div className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-subtle">
                No price is estimated here. Prices come from the published rate card and are fixed
                in a written quote after the scope is agreed.
              </div>
            </div>
          )}
        </aside>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-4 border-t border-border py-12">
        <div>
          <h2 className="font-serif text-2xl">Prefer to read first?</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            The seven service lines show their scope, exclusions and published rates. The field
            notes explain the checks that narrow a fault before anyone is booked.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/rates"
            className="cta-ghost inline-flex h-11 items-center rounded-md px-4 text-sm font-medium"
          >
            Published rates
          </Link>
          <Link
            to="/guides"
            className="cta-ghost inline-flex h-11 items-center rounded-md px-4 text-sm font-medium"
          >
            All guides
          </Link>
        </div>
      </section>
    </PublicFrame>
  );
}

function impactLabel(urgency: "now" | "soon" | "planned"): string {
  if (urgency === "now") return "Interrupted";
  if (urgency === "soon") return "Degraded";
  return "Planning";
}

function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  columns,
}: {
  legend: string;
  name: string;
  options: FinderOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  columns: 2 | 3;
}) {
  return (
    <fieldset>
      <legend className="font-serif text-2xl tracking-[-0.02em]">{legend}</legend>
      <div className={cn("mt-4 grid gap-2", columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <label
              key={option.id}
              className={cn(
                "cursor-pointer rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-ring/70",
                selected
                  ? "border-accent/50 bg-accent/10"
                  : "border-border bg-surface/50 hover:bg-raised/60",
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
              />
              <span className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1 size-2.5 shrink-0 rounded-full border",
                    selected ? "border-accent bg-accent" : "border-subtle",
                  )}
                />
                <span>
                  <span className="block text-sm font-medium text-fg">{option.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted">
                    {option.hint}
                  </span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
