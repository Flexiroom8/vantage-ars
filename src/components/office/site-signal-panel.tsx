import { useEffect, useState } from "react";
import { EmptyState } from "@/components/office/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getSiteSignals } from "@/lib/office/api";
import { formatDateTime } from "@/lib/office/format";
import type { SiteSignals } from "@/lib/office/site-signals";

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 font-serif text-3xl tabular-nums">{value}</p>
    </Card>
  );
}

function RankedList({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{title}</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{row.label}</span>
            <span className="font-mono text-xs tabular-nums text-muted">{row.count}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function SiteSignalPanel() {
  const [signals, setSignals] = useState<SiteSignals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getSiteSignals()
      .then((result) => {
        if (cancelled) return;
        setSignals(result);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setSignals(null);
        setError("The site-signal record could not be read from this session.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dailyMax = signals ? Math.max(1, ...signals.daily.map((day) => day.count)) : 1;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">Site signals</h2>
          <p className="mt-1 text-sm text-muted">
            Real public page views, recorded without an IP address, cookie or inferred identity.
          </p>
        </div>
        {signals ? <Badge>Last {signals.rangeDays} days</Badge> : null}
      </div>

      {error ? (
        <p
          role="status"
          className="rounded-xl bg-warn/15 px-4 py-3 text-sm text-warn shadow-[var(--shadow-border)]"
        >
          {error}
        </p>
      ) : loading && !signals ? (
        <Card className="p-4">
          <p className="text-sm text-muted">Reading the signal record…</p>
        </Card>
      ) : signals && signals.totalEvents === 0 ? (
        <EmptyState
          title="No site signals yet"
          body="The public site has not recorded a visit in this window. Nothing is invented to fill the gap."
        />
      ) : signals ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Figure label="Page views" value={signals.pageViews.toLocaleString("en-ZA")} />
            <Figure label="Recorded events" value={signals.totalEvents.toLocaleString("en-ZA")} />
            <Figure label="Countries" value={signals.countries.toLocaleString("en-ZA")} />
            <Figure label="Sources" value={signals.sources.toLocaleString("en-ZA")} />
          </div>

          <Card className="mt-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                Page views by day
              </p>
              <p className="font-mono text-[11px] text-subtle">
                {signals.daily[0]?.date} → {signals.daily.at(-1)?.date}
              </p>
            </div>
            <div className="mt-4 flex h-24 items-end gap-1" aria-hidden="true">
              {signals.daily.map((day) => (
                <div key={day.date} className="flex h-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-accent/70"
                    style={{ height: `${Math.round((day.count / dailyMax) * 100)}%` }}
                    title={`${day.date}: ${day.count}`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] text-subtle">
              <span>{signals.daily[0]?.date}</span>
              <span>{signals.daily.at(-1)?.date}</span>
            </div>
          </Card>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RankedList title="Top pages" rows={signals.topPages} />
            <RankedList title="Sources" rows={signals.topSources} />
            <RankedList title="Countries" rows={signals.topCountries} />
          </div>

          <Card className="mt-4 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Latest events</p>
            <ul className="mt-3 divide-y divide-border">
              {signals.recent.map((event, index) => (
                <li
                  key={`${event.occurredAt}-${event.path}-${index}`}
                  className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs">{event.path}</p>
                    <p className="text-xs text-muted">
                      {event.kind} · {event.country || "Unknown"}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-subtle">
                    {formatDateTime(event.occurredAt)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : null}
    </section>
  );
}
