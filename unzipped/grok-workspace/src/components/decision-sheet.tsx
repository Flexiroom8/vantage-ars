import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VerdictBadge } from "@/components/ui/verdict";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Meta } from "@/components/panel";
import { formatStamp, moneyFull, pct } from "@/lib/utils";
import { AGENTS } from "@/lib/aegis/data";
import { useAegis } from "@/lib/aegis/store";
import type { Decision } from "@/lib/aegis/types";

function AgentName(id: Decision["agentId"]) {
  return AGENTS.find((a) => a.id === id)?.name ?? id;
}

export function DecisionSheet() {
  const selectedId = useAegis((s) => s.selectedId);
  const decisions = useAegis((s) => s.decisions);
  const select = useAegis((s) => s.select);
  const d = decisions.find((x) => x.id === selectedId);

  return (
    <Sheet open={Boolean(d && selectedId)} onOpenChange={(open) => !open && select(null)}>
      {d ? (
        <SheetContent aria-describedby={undefined}>
          <SheetHeader>
            <div className="flex flex-wrap items-center gap-2">
              <VerdictBadge verdict={d.verdict} />
              <Badge>{d.type.replace("_", " ")}</Badge>
            </div>
            <SheetTitle className="mt-3">{d.title}</SheetTitle>
            <SheetDescription>{d.summary}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <RecordBody d={d} />
          </div>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

export function RecordBody({ d }: { d: Decision }) {
  return (
    <div className="space-y-6">
      <div>
        <Meta label="Decision">{d.id}</Meta>
        <Meta label="Agent">{AgentName(d.agentId)}</Meta>
        <Meta label="Counterparty">{d.counterparty}</Meta>
        <Meta label="Stamp">{formatStamp(d.timestamp)}</Meta>
        <Meta label="Value">{d.value ? moneyFull(d.value) : "—"}</Meta>
        <Meta label="Confidence">{pct(d.confidence, 0)}</Meta>
        <Meta label="Latency">{d.latencyMs} ms</Meta>
        <Meta label="Reversibility">{d.reversibility.replaceAll("_", " ")}</Meta>
      </div>

      <Separator />

      <div>
        <h3 className="font-display text-lg text-foreground">Governor</h3>
        <p className="mt-2 text-sm text-muted-foreground">{d.verdictReason}</p>
        <ul className="mt-4 space-y-2">
          {d.constraints.map((c) => (
            <li key={`${c.provision}-${c.check}`} className="rounded-sm bg-raised px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-primary">{c.provision}</span>
                <span className={c.passed ? "text-xs text-ok" : "text-xs text-danger"}>
                  {c.passed ? "passed" : "failed"}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3 font-mono text-xs text-muted-foreground">
                <span>{c.check}</span>
                <span className="tabular-nums">
                  {c.actual} / {c.limit}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-display text-lg text-foreground">Planning</h3>
        <ul className="mt-3 space-y-2">
          {d.strategies.map((s) => (
            <li key={s.id} className="rounded-sm bg-raised px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-foreground">{s.description}</p>
                {s.selected ? <Badge tone="accent">selected</Badge> : null}
              </div>
              {s.reasonRejected ? <p className="mt-1 text-xs text-muted-foreground">{s.reasonRejected}</p> : null}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-display text-lg text-foreground">Rationale</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d.rationale}</p>
      </div>

      <div>
        <h3 className="font-display text-lg text-foreground">Constitutional trace</h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {d.provisions.map((p) => (
            <Badge key={p} tone="accent">
              {p}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg text-foreground">Ledger</h3>
        <Meta label="Seq">{d.seq}</Meta>
        <Meta label="Prev">{d.merklePrev}</Meta>
        <Meta label="Root">{d.merkleHash}</Meta>
        <Meta label="Sig">{d.signature}</Meta>
      </div>
    </div>
  );
}
