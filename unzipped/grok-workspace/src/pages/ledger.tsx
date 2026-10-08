import { useMemo, useState } from "react";
import { Panel, Kicker } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { VerdictBadge } from "@/components/ui/verdict";
import { useAegis } from "@/lib/aegis/store";
import { formatStamp, money } from "@/lib/utils";
import type { GovernorVerdict } from "@/lib/aegis/types";

const FILTERS: { id: "all" | GovernorVerdict; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ALLOW", label: "Allow" },
  { id: "DENY", label: "Deny" },
  { id: "REVIEW", label: "Review" },
];

export function LedgerPage() {
  const decisions = useAegis((s) => s.decisions);
  const select = useAegis((s) => s.select);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...decisions].reverse().filter((d) => {
      if (filter !== "all" && d.verdict !== filter) return false;
      if (!needle) return true;
      return `${d.title} ${d.counterparty} ${d.id} ${d.agentId}`.toLowerCase().includes(needle);
    });
  }, [decisions, q, filter]);

  const allows = decisions.filter((d) => d.verdict === "ALLOW").length;
  const denies = decisions.filter((d) => d.verdict === "DENY").length;
  const reviews = decisions.filter((d) => d.verdict === "REVIEW").length;
  const tip = decisions[decisions.length - 1];

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Kicker>Tamper-evident log</Kicker>
        <h1 className="font-display text-4xl text-foreground md:text-5xl">Every decision, chained.</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Append-only. Each record carries a constitutional trace, evidence package, and an ed25519
          signature. Retention: seven years.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Panel>
          <Kicker>Records</Kicker>
          <p className="mt-2 font-display text-3xl tabular-nums">{decisions.length}</p>
        </Panel>
        <Panel>
          <Kicker>Allow</Kicker>
          <p className="mt-2 font-display text-3xl text-ok tabular-nums">{allows}</p>
        </Panel>
        <Panel>
          <Kicker>Deny</Kicker>
          <p className="mt-2 font-display text-3xl text-danger tabular-nums">{denies}</p>
        </Panel>
        <Panel>
          <Kicker>Review</Kicker>
          <p className="mt-2 font-display text-3xl text-warn tabular-nums">{reviews}</p>
        </Panel>
      </div>

      {tip ? (
        <Panel>
          <Kicker>Chain tip</Kicker>
          <p className="mt-2 truncate font-mono text-sm text-foreground">{tip.merkleHash}</p>
          <p className="mt-1 truncate font-mono text-xs text-subtle">{tip.signature}</p>
        </Panel>
      ) : null}

      <Panel className="p-0">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="ledger-q">
            Search ledger
          </label>
          <input
            id="ledger-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, agent, counterparty"
            className="h-11 flex-1 rounded-md bg-raised px-3 text-sm text-foreground shadow-[var(--shadow-border)] outline-none placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className="h-11 rounded-md px-3 text-xs"
              >
                <Badge tone={filter === f.id ? "accent" : "default"}>{f.label}</Badge>
              </button>
            ))}
          </div>
        </div>
        <ul>
          {rows.length === 0 ? (
            <li className="border-t border-border px-4 py-8 text-sm text-muted-foreground">No matching records.</li>
          ) : (
            rows.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => select(d.id)}
                  className="flex w-full flex-col gap-1 border-t border-border px-4 py-3 text-left transition-colors duration-150 hover:bg-raised sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="w-28 shrink-0 font-mono text-xs text-subtle">{d.id}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{d.title}</span>
                  <span className="hidden font-mono text-xs text-muted-foreground sm:block">{d.agentId}</span>
                  <span className="hidden font-mono text-xs text-muted-foreground tabular-nums md:block">
                    {d.value ? money(d.value) : "—"}
                  </span>
                  <span className="hidden text-xs text-subtle md:block">{formatStamp(d.timestamp)}</span>
                  <VerdictBadge verdict={d.verdict} />
                </button>
              </li>
            ))
          )}
        </ul>
      </Panel>
    </div>
  );
}
