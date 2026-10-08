import { Link } from "@tanstack/react-router";
import { Panel, Kicker } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { VerdictBadge } from "@/components/ui/verdict";
import { ENTITY, PIPELINE } from "@/lib/aegis/data";
import { useAegis } from "@/lib/aegis/store";
import { cn, formatClock, money, pct, score } from "@/lib/utils";

export function CommandPage() {
  const health = useAegis((s) => s.health);
  const budget = useAegis((s) => s.budget);
  const decisions = useAegis((s) => s.decisions);
  const agents = useAegis((s) => s.agents);
  const stage = useAegis((s) => s.pipelineStage);
  const paused = useAegis((s) => s.paused);
  const select = useAegis((s) => s.select);
  const feed = decisions.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
  const remaining = Math.max(0, budget.dailyMax - budget.spent);
  const used = budget.spent / budget.dailyMax;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Kicker>Northwind Industrial · Autonomous procurement</Kicker>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="max-w-xl font-display text-4xl text-foreground md:text-5xl">
            Operating without a human in the loop.
          </h1>
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent">A3 certified</Badge>
            <Badge>Gartner L4</Badge>
            <Badge>DDI {score(health.ddi)}</Badge>
          </div>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {ENTITY}. Day {health.dayOfAutonomy} of full autonomy. Escalations only on hard constraint
          breach. Policy sits outside the planner.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel className="p-6">
          <Kicker>Autonomy health</Kicker>
          <div className="mt-4 flex items-end gap-3">
            <span className="font-display text-6xl leading-none tracking-tight text-foreground tabular-nums md:text-7xl">
              {score(health.overall)}
            </span>
            <span className="mb-1 text-sm text-muted-foreground">of 1.00</span>
          </div>
          <ul className="mt-8 space-y-3">
            {health.dims.map((d) => (
              <li key={d.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{d.label}</span>
                  <span className="font-mono text-sm text-foreground tabular-nums">{score(d.score)}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-raised">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${Math.round(d.score * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs tracking-wider text-subtle uppercase">Intervention</dt>
              <dd className="mt-1 font-mono text-sm tabular-nums">{health.interventionPer10k}/10k</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wider text-subtle uppercase">Resolution</dt>
              <dd className="mt-1 font-mono text-sm tabular-nums">{pct(health.resolutionRate, 1)}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wider text-subtle uppercase">Hard breaches</dt>
              <dd className="mt-1 font-mono text-sm tabular-nums">0</dd>
            </div>
          </dl>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <Kicker>Autonomy budget · today</Kicker>
            <p className="mt-3 font-display text-3xl tabular-nums text-foreground">{money(remaining)}</p>
            <p className="text-sm text-muted-foreground">remaining of {money(budget.dailyMax)}</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-raised">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  used > 0.85 ? "bg-warn" : "bg-primary",
                )}
                style={{ width: `${Math.min(100, Math.round(used * 100))}%` }}
              />
            </div>
            <div className="mt-4 flex justify-between font-mono text-xs text-muted-foreground tabular-nums">
              <span>
                {budget.txCount}/{budget.txMax} tx
              </span>
              <span>
                {budget.irreversible}/{budget.irreversibleMax} irreversible
              </span>
            </div>
          </Panel>

          <Panel>
            <Kicker>Decision pipeline</Kicker>
            <ol className="mt-4 flex flex-wrap gap-1.5">
              {PIPELINE.map((step, i) => (
                <li
                  key={step}
                  className={cn(
                    "rounded-sm px-2 py-1 text-xs",
                    i <= stage ? "bg-primary text-primary-foreground" : "bg-raised text-muted-foreground",
                  )}
                >
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              Reasoning proposes. A separate control layer authorizes. Deny overrides review overrides
              allow.
            </p>
          </Panel>

          <Panel>
            <Kicker>Fleet</Kicker>
            <ul className="mt-3 divide-y divide-border">
              {agents.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        a.status === "nominal" ? "bg-ok" : a.status === "halted" ? "bg-danger" : "bg-warn",
                      )}
                    />
                    <span className="text-sm text-foreground">{a.name}</span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {a.decisionsToday} today
                  </span>
                </li>
              ))}
            </ul>
            <Link to="/fleet" className="mt-2 inline-block text-xs text-primary hover:underline">
              Open fleet
            </Link>
          </Panel>
        </div>
      </div>

      <Panel className="p-0">
        <div className="flex items-center justify-between px-4 py-4">
          <Kicker>Live ledger</Kicker>
          <span className="font-mono text-xs text-muted-foreground">
            {paused ? "frozen" : "append-only"}
          </span>
        </div>
        <ul>
          {feed.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => select(d.id)}
                className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left transition-colors duration-150 hover:bg-raised"
              >
                <span className="hidden w-16 shrink-0 font-mono text-xs text-subtle tabular-nums sm:block">
                  {formatClock(d.timestamp)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{d.title}</span>
                <span className="hidden font-mono text-xs text-muted-foreground tabular-nums md:block">
                  {d.value ? money(d.value) : "—"}
                </span>
                <VerdictBadge verdict={d.verdict} />
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
