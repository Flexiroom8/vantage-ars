import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PublicFrame } from "@/components/public/site-frame";
import { SignalBars } from "@/components/public/motion-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicStatus } from "@/lib/office/api";
import { breadcrumbJsonLd, businessJsonLd, pageHead } from "@/lib/site/seo";
import type { PublicStatusState } from "@/lib/office/public-status";

export const Route = createFileRoute("/status")({
  head: () => {
    const head = pageHead({
      title: "Desk status · Vantage-ARS",
      description:
        "A live readiness check for the Vantage-ARS desk: records, decision integrity, scheduled work, published prices and founder control. A readiness check, not an uptime guarantee.",
      path: "/status",
    });

    return {
      ...head,
      scripts: [
        businessJsonLd(),
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Status", path: "/status" },
        ]),
      ],
    };
  },
  loader: () => getPublicStatus(),
  component: StatusPage,
});

const STATE_COPY: Record<
  PublicStatusState,
  { label: string; variant: "ok" | "warn" | "danger"; heading: string }
> = {
  operational: {
    label: "Operational",
    variant: "ok",
    heading: "The desk is answering.",
  },
  degraded: {
    label: "Needs attention",
    variant: "warn",
    heading: "The desk is reachable, with a check to review.",
  },
  halted: {
    label: "Halted",
    variant: "danger",
    heading: "The desk is halted pending the founder.",
  },
};

function formatCheckedAt(value: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(value));
}

function StatusPage() {
  const status = Route.useLoaderData();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const copy = STATE_COPY[status.state] ?? STATE_COPY.degraded;

  async function refresh() {
    setRefreshing(true);
    try {
      await router.invalidate();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <PublicFrame>
      <section className="enter-up max-w-3xl py-16 sm:py-20">
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-2 font-mono text-xs tracking-[0.22em] text-accent uppercase">
            <SignalBars className="size-4" aria-hidden="true" />
            Desk status
          </p>
          <Badge variant={copy.variant}>{copy.label}</Badge>
        </div>

        <h1 className="mt-5 font-serif text-4xl leading-[1.03] tracking-[-0.03em] sm:text-6xl">
          {copy.heading}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">{status.summary}</p>
        <p className="mt-3 text-xs text-subtle">
          Checked {formatCheckedAt(status.checkedAt)} SAST · office version {status.version}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" disabled={refreshing} onClick={refresh}>
            {refreshing ? "Checking…" : "Check again"}
          </Button>
          <Link
            to="/support"
            className="cta-ghost inline-flex h-11 items-center rounded-md px-5 text-sm font-semibold"
          >
            Contact the desk
          </Link>
        </div>
      </section>

      <section className="border-t border-border py-12" aria-labelledby="checks-heading">
        <h2 id="checks-heading" className="font-serif text-3xl tracking-[-0.03em]">
          What was checked
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Each line is read from the office at the moment this page loaded. A failed line is shown
          as it is; nothing is rounded up to green.
        </p>

        <ul className="mt-8 space-y-3">
          {status.checks.map((check) => (
            <li
              key={check.id}
              className="flex gap-4 rounded-xl border border-border bg-surface/70 p-4"
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 size-2 shrink-0 rounded-full ${check.ok ? "bg-ok" : "bg-warn"}`}
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-fg">{check.label}</h3>
                  <span className="font-mono text-[10px] tracking-[0.16em] text-subtle uppercase">
                    {check.ok ? "Pass" : "Review"}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted">{check.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-border py-12" aria-labelledby="limits-heading">
        <h2 id="limits-heading" className="font-serif text-3xl tracking-[-0.03em]">
          What this page does not say
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "No uptime history",
              body: "The page reads the present. It keeps no public timeline of outages and makes no availability claim.",
            },
            {
              title: "No monitoring promise",
              body: "It does not watch a customer's estate. It reports whether the office itself can work.",
            },
            {
              title: "No service level",
              body: "A status line is information, not a contractual service level or a response guarantee.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold text-fg">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicFrame>
  );
}
