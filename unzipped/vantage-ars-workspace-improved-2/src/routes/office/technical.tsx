import { createFileRoute } from "@tanstack/react-router";
import { useOfficeSnapshot } from "@/components/office/office-context";
import { DispatchPanel } from "@/components/office/dispatch-panel";
import { EmptyState } from "@/components/office/empty-state";
import { PageHeader } from "@/components/office/page-header";
import { Badge } from "@/components/ui/badge";
import { TicketActions } from "@/components/office/ticket-actions";
import { formatDateTime } from "@/lib/office/money";

export const Route = createFileRoute("/office/technical")({
  component: TechnicalPage,
});


function TechnicalPage() {
  const snapshot = useOfficeSnapshot();
  const tickets = snapshot.tickets.filter((ticket) => ticket.ownerAgent === "forge" || ticket.ownerAgent === "keep");

  return (
    <div className="enter-up mx-auto max-w-5xl">
      <PageHeader
        kicker="Technical · FORGE · Admin · KEEP"
        title="Keep the machine running."
        description="Tickets and documents. No commercial binding. Tool spend still comes back to you."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <DispatchPanel
          lockedAgent="forge"
          placeholder="Open or update a technical ticket. Do not purchase tooling."
        />
        <DispatchPanel
          lockedAgent="keep"
          placeholder="Draft an internal document, filing note, or operational checklist."
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-2xl">Tickets</h2>
        {tickets.length === 0 ? (
          <EmptyState title="No tickets" body="FORGE is idle. Brief it when something actually breaks or needs building." />
        ) : (
          <ul className="space-y-2">
            {tickets.map((ticket) => (
              <li
                key={ticket.id}
                className="flex flex-col gap-2 rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-border)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm">{ticket.title}</p>
                  <p className="text-xs text-muted">
                    {ticket.summary} · {formatDateTime(ticket.updatedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={ticket.severity === "p0" ? "danger" : "default"}>{ticket.severity}</Badge>
                  <Badge variant={ticket.status === "resolved" ? "ok" : "warn"}>{ticket.status}</Badge>
                  <TicketActions id={ticket.id} status={ticket.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-2xl">Documents</h2>
        {snapshot.documents.length === 0 ? (
          <EmptyState title="No drafts" body="KEEP files what the office produces. Nothing is pre-written." />
        ) : (
          <ul className="divide-y divide-border rounded-xl bg-surface shadow-[var(--shadow-border)]">
            {snapshot.documents.map((doc) => (
              <li key={doc.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm">{doc.title}</p>
                  <Badge>{doc.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">{doc.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
