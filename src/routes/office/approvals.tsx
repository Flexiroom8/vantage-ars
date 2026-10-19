import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useOfficeSnapshot } from "@/components/office/office-context";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/office/empty-state";
import { MailNote } from "@/components/office/mail-note";
import { PageHeader } from "@/components/office/page-header";
import { TraceList } from "@/components/office/trace-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { decideApproval } from "@/lib/office/api";
import { AGENT_BY_ID } from "@/lib/office/agents";
import { formatDateTime, formatZar } from "@/lib/office/money";
import type { ApprovalRow } from "@/lib/office/types";

export const Route = createFileRoute("/office/approvals")({
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const snapshot = useOfficeSnapshot();
  const pending = snapshot.approvals.filter((a) => a.status === "pending");
  const resolved = snapshot.approvals.filter((a) => a.status !== "pending");

  return (
    <div className="enter-up mx-auto max-w-3xl">
      <PageHeader
        kicker="Founder desk"
        title="Approve only what the constitution cannot."
        description="Cost, customer win, customer loss, and marketing-to-sales handoffs stop here. Everything else already ran."
      />
      <MailNote notices={snapshot.notices} mail={snapshot.mail} />
      {pending.length === 0 ? (
        <EmptyState
          title="Clear desk"
          body="No spend, no customer-risk, no sales handoff is waiting. The office continues without you."
        />
      ) : (
        <div className="space-y-4">
          {pending.map((item) => (
            <ApprovalCard key={item.id} item={item} />
          ))}
        </div>
      )}
      {resolved.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 font-serif text-2xl">Resolved</h2>
          <ul className="space-y-2">
            {resolved.slice(0, 12).map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg bg-surface px-4 py-3 shadow-[var(--shadow-border)]"
              >
                <div>
                  <p className="text-sm">{item.title}</p>
                  <p className="text-xs text-muted">{formatDateTime(item.createdAt)}</p>
                </div>
                <Badge variant={item.status === "approved" ? "ok" : "danger"}>{item.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ApprovalCard({ item }: { item: ApprovalRow }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const agent = AGENT_BY_ID[item.agentId];

  async function resolve(decision: "approved" | "rejected") {
    setPending(true);
    try {
      const result = await decideApproval({ data: { approvalId: item.id, decision, note } });
      if (!result.ok) {
        toast.error(result.error ?? "Could not resolve.");
        return;
      }
      toast.success(decision === "approved" ? "Executed." : "Held.");
      await router.invalidate();
    } catch {
      // This is the path that executes a cost, a customer win/loss or a spend.
      // If it fails mid-flight the founder must know, or they will click again
      // unsure whether the action already ran.
      toast.error("The decision could not be recorded — check the audit ledger before retrying.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted">
            {agent?.callsign ?? item.agentId} · {item.kind.replaceAll("_", " ")}
          </p>
          <h2 className="mt-1 font-serif text-2xl">{item.title}</h2>
        </div>
        <Badge
          variant={
            item.kind === "cost" ? "warn" : item.kind.startsWith("customer") ? "danger" : "default"
          }
        >
          {item.kind.replaceAll("_", " ")}
        </Badge>
      </div>
      <p className="mt-3 text-sm text-muted">{item.rationale}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted">Amount</dt>
          <dd className="mt-1 font-mono tabular-nums">{formatZar(item.amountCents)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted">Company</dt>
          <dd className="mt-1">{item.companyName ?? "—"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs uppercase tracking-[0.14em] text-muted">Filed</dt>
          <dd className="mt-1 text-muted">{formatDateTime(item.createdAt)}</dd>
        </div>
      </dl>
      <div className="mt-5">
        <p className="mb-2 text-xs uppercase tracking-[0.14em] text-muted">Constitutional trace</p>
        <TraceList trace={item.constitutionalTrace} />
      </div>
      <Label htmlFor="approval-note" className="sr-only">
        Note for the audit ledger (optional)
      </Label>
      <Textarea
        id="approval-note"
        className="mt-5"
        placeholder="Note for the audit ledger (optional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" disabled={pending} onClick={() => void resolve("rejected")}>
          Reject
        </Button>
        <Button disabled={pending} onClick={() => void resolve("approved")}>
          Approve and execute
        </Button>
      </div>
    </Card>
  );
}
