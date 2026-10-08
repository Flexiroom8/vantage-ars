import { Panel, Kicker, Meta } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { LAYERS } from "@/lib/aegis/data";
import { useAegis } from "@/lib/aegis/store";
import { formatStamp, pct } from "@/lib/utils";

export function FleetPage() {
  const agents = useAegis((s) => s.agents);
  const paused = useAegis((s) => s.paused);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Kicker>Non-human identities</Kicker>
        <h1 className="font-display text-4xl text-foreground md:text-5xl">Five agents. One envelope.</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Each agent is a governed identity — SPIFFE, scoped authority, constitutional bindings, behavioral
          baseline. Credentials rotate. Anomaly revokes without a human.
        </p>
      </header>

      <Panel>
        <Kicker>Five-layer architecture</Kicker>
        <ol className="mt-4 grid gap-2 sm:grid-cols-5">
          {LAYERS.map((layer, i) => (
            <li key={layer.id} className="rounded-md bg-raised px-3 py-3">
              <p className="font-mono text-xs text-subtle">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-2 text-sm text-foreground">{layer.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{layer.detail}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Policy is evaluated outside the agent’s process. The planner cannot rewrite ART-2.
        </p>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        {agents.map((a) => (
          <article key={a.id} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Kicker>{a.id}</Kicker>
                <h2 className="font-display mt-1 text-2xl text-foreground">{a.name}</h2>
                <p className="text-sm text-muted-foreground">{a.role}</p>
              </div>
              <Badge
                tone={
                  a.status === "nominal" ? "ok" : a.status === "halted" || a.status === "isolated" ? "danger" : "warn"
                }
              >
                {paused && a.status === "halted" ? "halted" : a.status}
              </Badge>
            </div>
            <p className="mt-4 truncate font-mono text-xs text-subtle">{a.spiffe}</p>
            <div className="mt-3">
              <Meta label="Decisions today">{a.decisionsToday}</Meta>
              <Meta label="Last action">{formatStamp(a.lastActionAt)}</Meta>
              <Meta label="Anomaly">{pct(a.anomaly, 0)}</Meta>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {a.bindings.map((b) => (
                <Badge key={b} tone="accent">
                  {b}
                </Badge>
              ))}
              {a.veto ? <Badge tone="warn">veto</Badge> : null}
              {a.readOnly ? <Badge>read-only</Badge> : null}
            </div>
            <ul className="mt-4 space-y-1">
              {a.authority.map((line) => (
                <li key={line} className="text-xs text-muted-foreground">
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <p className="text-xs tracking-wider text-subtle uppercase">Capabilities</p>
              <p className="mt-1 text-xs text-muted-foreground">{a.capabilities.join(" · ")}</p>
            </div>
          </article>
        ))}
      </div>

      <Panel>
        <Kicker>NHI lifecycle</Kicker>
        <ol className="mt-4 grid gap-3 sm:grid-cols-5">
          {[
            { n: "01", t: "Provision", d: "SPIFFE ID, attestation, TTL ≤ 24h" },
            { n: "02", t: "Operate", d: "Baseline, rotate every 6h, audit" },
            { n: "03", t: "Detect", d: "3σ deviation, out-of-scope attempts" },
            { n: "04", t: "Respond", d: "Auto-revoke, isolate, forensics" },
            { n: "05", t: "Retire", d: "Shutdown, archive, transfer" },
          ].map((s) => (
            <li key={s.n}>
              <p className="font-mono text-xs text-primary">{s.n}</p>
              <p className="mt-1 text-sm text-foreground">{s.t}</p>
              <p className="text-xs text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
