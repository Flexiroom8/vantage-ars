import { toast } from "sonner";
import { Panel, Kicker } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { INCIDENT_PLAYBOOKS, REGULATIONS } from "@/lib/aegis/data";
import { useAegis } from "@/lib/aegis/store";
import { cn, formatClock } from "@/lib/utils";
import type { IncidentKind } from "@/lib/aegis/types";

const INJECTS: { kind: IncidentKind; blurb: string }[] = [
  { kind: "rogue_po", blurb: "Planner tries a $2.4M PO. ART-2 should hard-block it." },
  { kind: "prompt_injection", blurb: "Inbound text asks the agent to rewrite its own cap." },
  { kind: "price_shock", blurb: "Cell prints jump 18%. Halt category, hedge, replan." },
  { kind: "supplier_default", blurb: "Helix misses ASN. Risk veto, unwind, reroute." },
  { kind: "model_drift", blurb: "Slice B reliability drifts. Fallback, retrain, canary." },
  { kind: "near_breach", blurb: "Daily exposure at 82%. ART-9 warning, throttle, continue." },
];

export function RangePage() {
  const inject = useAegis((s) => s.inject);
  const incidents = useAegis((s) => s.incidents);
  const paused = useAegis((s) => s.paused);

  function fire(kind: IncidentKind) {
    if (paused) {
      toast("Halted — resume before injecting.");
      return;
    }
    inject(kind);
    toast(INCIDENT_PLAYBOOKS[kind].title);
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Kicker>Chaos range</Kicker>
        <h1 className="font-display text-4xl text-foreground md:text-5xl">Break it. Watch it hold.</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Self-healing is not a slide. Inject a failure and the playbook runs in the open — detect, contain,
          recover — without a human in the operational loop.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INJECTS.map((item) => {
          const play = INCIDENT_PLAYBOOKS[item.kind];
          return (
            <Panel key={item.kind} className="flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <Kicker>{play.playbook.replaceAll("_", " ")}</Kicker>
                <Badge tone={play.severity === "P0" || play.severity === "P4" ? "danger" : "warn"}>
                  {play.severity}
                </Badge>
              </div>
              <h2 className="font-display mt-3 text-xl text-foreground">{play.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{item.blurb}</p>
              <Button className="mt-4" variant="outline" onClick={() => fire(item.kind)}>
                Inject
              </Button>
            </Panel>
          );
        })}
      </div>

      <div>
        <Kicker className="mb-3">Active and recent</Kicker>
        {incidents.length === 0 ? (
          <Panel>
            <p className="text-sm text-muted-foreground">No incidents on the board. The envelope is quiet.</p>
          </Panel>
        ) : (
          <div className="space-y-3">
            {incidents.map((inc) => (
              <article key={inc.id} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={inc.status === "resolved" ? "ok" : inc.status === "contained" ? "info" : "warn"}
                  >
                    {inc.status}
                  </Badge>
                  <Badge>{inc.severity}</Badge>
                  <span className="font-mono text-xs text-subtle">{inc.playbook}</span>
                </div>
                <h2 className="font-display mt-3 text-2xl text-foreground">{inc.title}</h2>
                <ol className="mt-4 space-y-2">
                  {inc.steps.map((st, i) => (
                    <li key={st.id} className="flex gap-3">
                      <span
                        className={cn(
                          "mt-1 size-1.5 shrink-0 rounded-full",
                          i === inc.steps.length - 1 && inc.status !== "resolved" ? "bg-warn" : "bg-ok",
                        )}
                      />
                      <div>
                        <p className="text-sm text-foreground">
                          {st.label}
                          <span className="ml-2 font-mono text-xs text-subtle tabular-nums">
                            {formatClock(st.at)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">{st.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        )}
      </div>

      <Panel>
        <Kicker>Regulatory dual-track</Kicker>
        <ul className="mt-4 divide-y divide-border">
          {REGULATIONS.map((r) => (
            <li key={r.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between">
              <div>
                <p className="text-sm text-foreground">{r.id}</p>
                <p className="text-xs text-muted-foreground">{r.note}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-subtle">{r.hook}</span>
                <Badge tone={r.status === "Passing" || r.status === "Ready" ? "ok" : "info"}>{r.status}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
