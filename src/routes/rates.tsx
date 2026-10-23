import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pageHead, businessJsonLd, breadcrumbJsonLd, offerCatalogJsonLd } from "../lib/site/seo";
import { PublicFrame } from "@/components/public/site-frame";
import { Button } from "@/components/ui/button";
import { SignalBars } from "@/components/public/motion-icons";
import { toast } from "sonner";
import { RATE_GROUPS, rateAmount, ratesByIds } from "../lib/office/catalogue";
import { cn } from "../lib/utils";

const GROUP_IDS = ["labour", "quoted", "managed", "outside"] as const;

/** Every published group, paired with the anchor it scrolls to. */
const GROUPS = RATE_GROUPS.map((group, index) => ({
  ...group,
  id: GROUP_IDS[index] ?? `group-${index + 1}`,
}));

export const Route = createFileRoute("/rates")({
  head: () => {
    const head = pageHead({
      title: "Rates · Vantage-ARS",
      description:
        "Published Vantage-ARS rates in South African rand. Labour by the hour, quoted work at a fixed figure, managed services at a fixed price. A written quote confirms the total.",
      path: "/rates",
    });

    return {
      ...head,
      scripts: [
        businessJsonLd(),
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Rates", path: "/rates" },
        ]),
        offerCatalogJsonLd({ name: "Vantage-ARS published rates", path: "/rates" }),
      ],
    };
  },
  component: RatesPage,
});

function RatesPage() {
  const [active, setActive] = useState(0);
  const [generating, setGenerating] = useState(false);

  async function downloadRateCard() {
    if (generating) return;
    setGenerating(true);
    try {
      const [{ buildRateCardPdf, RATE_CARD_FILENAME }, { downloadPdf }] = await Promise.all([
        import("@/lib/site/rate-card-pdf"),
        import("@/lib/office/quote-pdf"),
      ]);
      downloadPdf(await buildRateCardPdf(), RATE_CARD_FILENAME);
    } catch {
      toast.error("The rate card could not be generated.");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    const sections = GROUPS.map((group) => document.getElementById(`rate-${group.id}`)).filter(
      (el): el is HTMLElement => Boolean(el),
    );
    if (sections.length === 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = sections.indexOf(entry.target as HTMLElement);
            if (index >= 0) setActive(index);
          }
        }
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <PublicFrame>
      <article className="enter-up pb-8 pt-16 lg:pt-24">
        <p className="flex items-center gap-2 font-mono text-xs tracking-[0.22em] text-accent uppercase">
          <SignalBars className="size-4" aria-hidden="true" />
          Published rates
        </p>
        <h1 className="mt-5 max-w-3xl text-5xl leading-[1.02] tracking-[-0.03em] sm:text-7xl">
          See the price before you say yes.
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted">
          Remote help starts at R{rateAmount("remote-support")} an hour. On-site help starts at R
          {rateAmount("onsite-support")} an hour. Both are in South African rand. VAT is added only
          when the written quote says so.
        </p>

        <p className="mt-4 max-w-2xl leading-relaxed text-muted">
          Labour is charged by the hour. Quoted work gets a fixed figure once the site, the devices
          and the scope are known. Managed services have a fixed scope and a fixed price, are
          produced from our own records, and are remote only. Nothing in the managed group is a
          monitoring service, an uptime promise or a contractual service level.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6"
          disabled={generating}
          onClick={() => void downloadRateCard()}
        >
          {generating ? "Generating…" : "Download rate card PDF"}
        </Button>
      </article>

      <nav
        aria-label="Rate groups"
        className="sticky top-14 z-20 -mx-5 mb-4 border-y border-border bg-bg/90 px-5 py-3 backdrop-blur-md sm:-mx-8 sm:px-8"
      >
        <div className="flex flex-wrap gap-2">
          {GROUPS.map((group, index) => (
            <a
              key={group.title}
              href={`#rate-${group.id}`}
              onClick={(event) => {
                event.preventDefault();
                document
                  .getElementById(`rate-${group.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="spy-pill rounded-full px-3.5 py-1.5 text-sm font-medium"
              data-active={active === index}
              aria-current={active === index ? "true" : undefined}
            >
              {group.title}
            </a>
          ))}
        </div>
      </nav>

      {GROUPS.map((group, index) => {
        const groupRates = ratesByIds(group.ids);

        return (
          <section
            key={group.title}
            id={`rate-${group.id}`}
            className="scroll-mt-32 border-t border-border py-16"
          >
            <div className="grid gap-8 lg:grid-cols-[16rem_1fr] lg:gap-16">
              <div>
                <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-2 text-4xl">{group.title}</h2>
                <p className="mt-4 text-sm leading-relaxed text-muted">{group.note}</p>
              </div>
              <ul className="border-t border-border">
                {groupRates.length === 0 ? (
                  <li className="border-b border-border py-6 text-sm text-muted">
                    No rates in this group.
                  </li>
                ) : (
                  groupRates.map((rate) => (
                    <li
                      key={rate.id}
                      className={cn(
                        "grid gap-2 border-b border-border py-6 transition-colors hover:bg-raised/40 sm:grid-cols-[1fr_11rem] sm:gap-8",
                        !rate.offered && "opacity-60",
                      )}
                    >
                      <div>
                        <h3 className="font-semibold">{rate.title}</h3>
                        <p className="mt-1 text-sm text-muted">{rate.scope}</p>
                        <p className="mt-2 text-sm text-subtle">{rate.basis}</p>
                      </div>
                      <p className="font-mono text-sm font-medium text-accent sm:text-right">
                        {rate.offered ? rate.price : "Not offered"}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </section>
        );
      })}
      <p className="flex flex-wrap gap-3 border-t border-border py-16">
        <Link
          to="/"
          hash="enquiry"
          className="cta inline-flex h-11 items-center rounded-md px-5 text-sm font-semibold"
        >
          Get a written quote
        </Link>
        <Link
          to="/"
          hash="payment"
          className="cta-ghost inline-flex h-11 items-center rounded-md px-5 text-sm font-semibold"
        >
          How to pay
        </Link>
      </p>
    </PublicFrame>
  );
}
