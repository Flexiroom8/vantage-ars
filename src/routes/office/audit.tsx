import { createFileRoute } from "@tanstack/react-router";
import { useOfficeSnapshot } from "@/components/office/office-context";
import { EmptyState } from "@/components/office/empty-state";
import { PageHeader } from "@/components/office/page-header";
import { TraceList } from "@/components/office/trace-list";
import { Badge } from "@/components/ui/badge";
import { headMatches } from "@/lib/office/integrity";
import { formatDateTime } from "@/lib/office/money";

export const Route = createFileRoute("/office/audit")({
  component: AuditPage,
});


function AuditPage() {
  const snapshot = useOfficeSnapshot();
  const intact = headMatches(snapshot.company.lastAuditHash, snapshot.decisions, snapshot.audit);

  return (
    <div className="enter-up mx-auto max-w-4xl">
      <PageHeader
        kicker="ART-5 · seven year retention"
        title="Every act is chained."
        description={`Head ${snapshot.company.lastAuditHash.slice(0, 16)}… Each write hashes the last. Tampering breaks the head.`}
      />
      <p className="mb-8 text-sm text-muted">
        Integrity:{" "}
        <span className={intact ? "text-ok" : "text-danger"}>
          {intact ? "head matches latest record" : "head diverges from latest windowed record"}
        </span>
      </p>

      <section className="mb-10">
        <h2 className="mb-3 font-serif text-2xl">Ledger events</h2>
        {snapshot.audit.length === 0 ? (
          <EmptyState title="Chain not yet grown" body="Opening the office writes the genesis event." />
        ) : (
          <ol className="space-y-2">
            {snapshot.audit.map((event) => (
              <li key={event.id} className="rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-border)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">{event.title}</p>
                  <Badge>{event.kind.replaceAll("_", " ")}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{event.body}</p>
                <p className="mt-2 font-mono text-[11px] text-subtle">
                  {event.actor} · {formatDateTime(event.createdAt)} · {event.recordHash.slice(0, 16)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-serif text-2xl">Decision records</h2>
        {snapshot.decisions.length === 0 ? (
          <EmptyState title="No decisions" body="Dispatch an agent to write the first constitutional trace." />
        ) : (
          <ol className="space-y-3">
            {snapshot.decisions.map((decision) => (
              <li key={decision.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm">{decision.title}</p>
                    <p className="text-xs text-muted">
                      {decision.agentId} · {decision.actionKind} · {formatDateTime(decision.createdAt)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      decision.status === "blocked"
                        ? "danger"
                        : decision.status === "escalated"
                          ? "warn"
                          : "ok"
                    }
                  >
                    {decision.status}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted">{decision.rationale}</p>
                <p className="mt-2 font-mono text-[11px] text-subtle">
                  conf {decision.confidence.toFixed(2)} · {decision.reversibility.replaceAll("_", " ")} ·{" "}
                  {decision.recordHash.slice(0, 16)}
                </p>
                <div className="mt-3">
                  <TraceList trace={decision.constitutionalTrace} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
