import { createFileRoute } from "@tanstack/react-router";
import { useOfficeSnapshot } from "@/components/office/office-context";
import { DispatchPanel } from "@/components/office/dispatch-panel";
import { EmptyState } from "@/components/office/empty-state";
import { PageHeader } from "@/components/office/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatZar } from "@/lib/office/money";

export const Route = createFileRoute("/office/marketing")({
  component: MarketingPage,
});


function MarketingPage() {
  const snapshot = useOfficeSnapshot();
  const ready = snapshot.leads.filter((l) => l.stage === "ready_for_sales" || l.stage === "in_sales");

  return (
    <div className="enter-up mx-auto max-w-5xl">
      <PageHeader
        kicker="Marketing · SIGNAL"
        title="Demand ends at the handoff."
        description="Campaigns and qualification run autonomously at R0. Paid spend and every sales handoff wait on you."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <DispatchPanel
          lockedAgent="signal"
          placeholder="Draft an organic campaign for vantage-ars.co.za. If a lead is sales-ready, file a handoff — do not sell."
        />
        <Card>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Boundary</p>
          <p className="mt-2 font-serif text-2xl">ART-11 / ART-12</p>
          <p className="mt-2 text-sm text-muted">
            SIGNAL may create and qualify leads. The moment work becomes a sale it files a founder
            approval and stops. Sales cannot see a company until you move it.
          </p>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-2xl">Campaigns</h2>
        {snapshot.campaigns.length === 0 ? (
          <EmptyState title="No campaigns" body="Brief SIGNAL. Organic work can run. Paid media cannot." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {snapshot.campaigns.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-serif text-xl">{c.name}</p>
                  <Badge>{c.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted">{c.summary}</p>
                <p className="mt-3 font-mono text-xs text-subtle">
                  {c.channel} · budget {formatZar(c.budgetCents)}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-2xl">Leads</h2>
        {snapshot.leads.length === 0 ? (
          <EmptyState title="No leads" body="Inbound and campaigns feed this list. Nothing is invented." />
        ) : (
          <ul className="divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]">
            {snapshot.leads.map((lead) => (
              <li key={lead.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm">{lead.companyName}</p>
                  <p className="text-xs text-muted">{lead.summary}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs tabular-nums text-muted">{lead.score}</span>
                  <Badge variant={ready.some((r) => r.id === lead.id) ? "warn" : "default"}>{lead.stage}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
