import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pageHead } from "../lib/site/seo";
import { PublicFrame } from "@/components/public/site-frame";
import { SignalBars } from "@/components/public/motion-icons";
import { RATE_GROUPS, ratesByIds } from "../lib/office/catalogue";
import { cn } from "../lib/utils";

const GROUP_IDS = ["labour", "quoted", "outside"] as const;

export const Route = createFileRoute("/rates")({
  head: () => pageHead({ title: "Rates · Vantage-ARS", description: "Published Vantage-ARS rates in South African rand. A written quote confirms the total. Managed support is not offered.", path: "/rates" }),
  component: RatesPage,
});

function RatesPage() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const sections = GROUP_IDS.map((id) => document.getElementById(`rate-${id}`)).filter(
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
          Remote help starts at R690 an hour. On-site help starts at R805 an hour. Both are in South African rand. VAT is added only when the written quote says so.
        </p>
      </article>

      <nav aria-label="Rate groups" className="sticky top-14 z-20 -mx-5 mb-4 border-y border-border bg-bg/90 px-5 py-3 backdrop-blur-md sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap gap-2">
          {RATE_GROUPS.map((group, index) => (
            <a
              key={group.title}
              href={`#rate-${GROUP_IDS[index]}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(`rate-${GROUP_IDS[index]}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
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

      {RATE_GROUPS.map((group, index) => (
        <section
          key={group.title}
          id={`rate-${GROUP_IDS[index]}`}
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
              {ratesByIds(group.ids).map((rate) => (
                <li key={rate.id} className={cn("grid gap-2 border-b border-border py-6 transition-colors hover:bg-raised/40 sm:grid-cols-[1fr_11rem] sm:gap-8", !rate.offered && "opacity-60")}>
                  <div>
                    <h3 className="font-semibold">{rate.title}</h3>
                    <p className="mt-1 text-sm text-muted">{rate.scope}</p>
                    <p className="mt-2 text-sm text-subtle">{rate.basis}</p>
                  </div>
                  <p className="font-mono text-sm font-medium text-accent sm:text-right">
                    {rate.offered ? rate.price : "Not offered"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
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
