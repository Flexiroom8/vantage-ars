import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/office/empty-state";
import { PageHeader } from "@/components/office/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelSubscription, getCustomerNotices, getRevenue } from "@/lib/office/api";
import { formatDate, formatDateTime, formatZar } from "@/lib/office/format";
import { PLANS } from "@/lib/office/plans";
import type {
  BillingCycleRow,
  BillingCycleStatus,
  RevenueMetrics,
  SubscriptionRow,
  SubscriptionStatus,
} from "@/lib/office/types";

export const Route = createFileRoute("/office/revenue")({
  component: RevenuePage,
});

type RevenueBook = {
  subscriptions: SubscriptionRow[];
  cycles: BillingCycleRow[];
  metrics: RevenueMetrics;
};

type NoticeRow = {
  id: string;
  companyName: string | null;
  template: string;
  recipient: string;
  subject: string;
  status: string;
  detail: string | null;
  createdAt: string;
  sentAt: string | null;
};

type NoticeStatus = "approved_unsent" | "sent" | "not_delivered";

function readRevenueBook() {
  return Promise.allSettled([getRevenue(), getCustomerNotices()]);
}

function RevenuePage() {
  const [book, setBook] = useState<RevenueBook | null>(null);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookError, setBookError] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState<string | null>(null);

  const apply = useCallback(
    (revenue: PromiseSettledResult<RevenueBook>, sent: PromiseSettledResult<NoticeRow[]>) => {
      if (revenue.status === "fulfilled") {
        setBook(revenue.value);
        setBookError(null);
      } else {
        setBook(null);
        setBookError("The recurring-revenue book could not be read from this session.");
      }
      if (sent.status === "fulfilled") {
        setNotices(sent.value);
        setNoticeError(null);
      } else {
        setNotices([]);
        setNoticeError("The customer mail record could not be read from this session.");
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void readRevenueBook().then(([revenue, sent]) => {
      if (cancelled) return;
      apply(revenue, sent);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [revenue, sent] = await readRevenueBook();
    apply(revenue, sent);
    setLoading(false);
  }, [apply]);

  const metrics = book?.metrics ?? null;
  const subscriptions = book?.subscriptions ?? [];
  const cycles = book?.cycles ?? [];
  const planTitles = usePlanTitles(metrics);

  return (
    <div className="enter-up mx-auto max-w-5xl">
      <PageHeader
        kicker="Recurring revenue"
        title="A subscription is a promise on a calendar."
        description="Customers on managed plans, billed on a cycle, given a written report each period. The office emails the report and the invoice only where the founder has delegated the authority to do so."
      />

      {bookError ? (
        <p
          role="status"
          className="mb-6 rounded-xl bg-warn/15 px-4 py-3 text-sm text-warn shadow-[var(--shadow-border)]"
        >
          {bookError}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-3"
            disabled={loading}
            onClick={() => void refresh()}
          >
            {loading ? "Reading…" : "Try again"}
          </Button>
        </p>
      ) : null}

      {metrics ? (
        <MetricStrip metrics={metrics} />
      ) : bookError ? null : (
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Recurring revenue</p>
          <p className="mt-2 text-sm text-muted">Reading the book…</p>
        </Card>
      )}

      {book ? (
        <>
          <section className="mt-8">
            <h2 className="mb-3 font-serif text-2xl">Plans</h2>
            <p className="mb-3 text-sm text-muted">
              What the active subscriptions earn each month, by plan. One-off work is not recurring
              revenue and is not counted here.
            </p>
            {metrics && metrics.planMix.length > 0 ? (
              <PlansTable mix={metrics.planMix} />
            ) : (
              <EmptyState
                title="No plans in use"
                body="No active subscription sits on a productised plan yet, so there is no recurring mix to report."
              />
            )}
          </section>

          <section className="mt-8">
            <h2 className="mb-3 font-serif text-2xl">Subscriptions</h2>
            <p className="mb-3 text-sm text-muted">
              Every customer the office bills on a cycle. Ending one is a founder decision, and the
              reason is written onto the record.
            </p>
            {subscriptions.length > 0 ? (
              <SubscriptionsTable
                rows={subscriptions}
                planTitles={planTitles}
                onEnded={() => void refresh()}
              />
            ) : (
              <EmptyState
                title="No subscriptions"
                body="Nothing is on a recurring plan. The office bills work one job at a time until a customer accepts a managed plan."
              />
            )}
          </section>

          <section className="mt-8">
            <h2 className="mb-3 font-serif text-2xl">Billing periods</h2>
            <p className="mb-3 text-sm text-muted">
              One row per period of every subscription: what was billed, whether the report was
              written, whether the customer was emailed, and whether the money arrived.
            </p>
            {cycles.length > 0 ? (
              <CyclesTable rows={cycles} planTitles={planTitles} />
            ) : (
              <EmptyState
                title="No billing periods"
                body="No subscription has reached a billing date yet, so there is nothing on the cycle ledger."
              />
            )}
          </section>
        </>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-2xl">Customer mail record</h2>
        <p className="mb-3 text-sm text-muted">
          Every email the office has sent to a customer, and whether it arrived. This is the
          office&apos;s own record of what went out — not a claim that it was read.
        </p>
        {noticeError ? (
          <p role="status" className="rounded-xl bg-warn/15 px-4 py-3 text-sm text-warn">
            {noticeError}
          </p>
        ) : notices.length > 0 ? (
          <NoticesTable rows={notices} />
        ) : (
          <EmptyState
            title="No customer email"
            body="The office has not emailed a customer yet. It only does so from a written template, and only under a standing delegation."
          />
        )}
      </section>
    </div>
  );
}

function usePlanTitles(metrics: RevenueMetrics | null): Map<string, string> {
  return useMemo(() => {
    const titles = new Map<string, string>();
    for (const plan of PLANS) titles.set(plan.id, plan.title);
    for (const mix of metrics?.planMix ?? []) titles.set(mix.planId, mix.title);
    return titles;
  }, [metrics]);
}

function MetricStrip({ metrics }: { metrics: RevenueMetrics }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Figure label="Monthly recurring" value={formatZar(metrics.monthlyRecurringCents)} />
      <Figure label="Annual recurring" value={formatZar(metrics.annualRecurringCents)} />
      <Figure label="Active subscriptions" value={String(metrics.activeSubscriptions)} />
      <Figure label="Collected this month" value={formatZar(metrics.collectedThisMonthCents)} />
      <Figure label="Outstanding" value={formatZar(metrics.outstandingCents)} />
      <Figure
        label="Overdue"
        value={formatZar(metrics.overdueCents)}
        tone={metrics.overdueCents > 0 ? "danger" : undefined}
      />
      <Figure
        label="Churn risk"
        value={String(metrics.churnRiskCount)}
        tone={metrics.churnRiskCount > 0 ? "warn" : undefined}
      />
      <Figure label="One-off pipeline" value={formatZar(metrics.oneOffPipelineCents)} />
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "danger";
}) {
  const toneClass = tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "";
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={`mt-2 font-mono text-2xl tabular-nums ${toneClass}`}>{value}</p>
    </Card>
  );
}

function PlansTable({ mix }: { mix: RevenueMetrics["planMix"] }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-surface shadow-[var(--shadow-border)]">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <caption className="sr-only">
          Active subscriptions and their monthly contribution, by plan.
        </caption>
        <thead className="text-xs uppercase tracking-[0.14em] text-muted">
          <tr className="border-b border-border">
            <th scope="col" className="px-4 py-3 font-medium">
              Plan
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-right">
              Subscriptions
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-right">
              Monthly contribution
            </th>
          </tr>
        </thead>
        <tbody>
          {mix.map((row) => (
            <tr key={row.planId} className="border-b border-border last:border-0">
              <td className="px-4 py-3">{row.title}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">{row.subscriptions}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">
                {formatZar(row.monthlyCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubscriptionsTable({
  rows,
  planTitles,
  onEnded,
}: {
  rows: SubscriptionRow[];
  planTitles: Map<string, string>;
  onEnded: () => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl bg-surface shadow-[var(--shadow-border)]">
      <table className="w-full min-w-[52rem] text-left text-sm">
        <caption className="sr-only">
          Every recurring subscription, with its price, cycle, status and next billing date.
        </caption>
        <thead className="text-xs uppercase tracking-[0.14em] text-muted">
          <tr className="border-b border-border">
            <th scope="col" className="px-4 py-3 font-medium">
              Customer
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Plan
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-right">
              Price
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Cycle
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Next billing
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-right">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const ended = row.status === "cancelled" || row.status === "completed";
            return (
              <tr
                key={row.id}
                className={`border-b border-border last:border-0 ${ended ? "opacity-60" : ""}`}
              >
                <td className="px-4 py-3">
                  <p>{row.companyName}</p>
                  {row.contactName || row.contactEmail ? (
                    <p className="mt-1 text-xs text-muted">
                      {[row.contactName, row.contactEmail].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3">{planTitles.get(row.planId) ?? row.planId}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {formatZar(row.priceCents)}
                </td>
                <td className="px-4 py-3">{cycleLabel(row.cycle)}</td>
                <td className="px-4 py-3">
                  <Badge variant={subscriptionBadge(row.status)}>
                    {subscriptionLabel(row.status)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted">
                  {ended ? "—" : formatDate(row.nextBillingAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  {row.status === "active" ? (
                    <EndSubscription subscription={row} onEnded={onEnded} />
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EndSubscription({
  subscription,
  onEnded,
}: {
  subscription: SubscriptionRow;
  onEnded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonId = `end-reason-${subscription.id}`;

  async function onConfirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Say why the subscription is ending. The reason goes on the record.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await cancelSubscription({
        data: { subscriptionId: subscription.id, reason: trimmed },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Subscription ended. The record says why.");
      setOpen(false);
      setReason("");
      onEnded();
    } catch {
      setError("The subscription could not be ended. Nothing was changed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          End subscription
          <span className="sr-only"> for {subscription.companyName}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>End this subscription?</DialogTitle>
        <DialogDescription>
          {subscription.companyName} stops billing from the end of the current cycle. The reason is
          written onto the customer record and cannot be edited afterwards.
        </DialogDescription>
        <div className="mt-4">
          <Label htmlFor={reasonId}>Why is it ending?</Label>
          <Textarea
            id={reasonId}
            className="mt-2"
            value={reason}
            maxLength={240}
            placeholder="Customer moved to a different plan."
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Keep it running
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={() => void onConfirm()}
          >
            {pending ? "Ending…" : "End subscription"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CyclesTable({
  rows,
  planTitles,
}: {
  rows: BillingCycleRow[];
  planTitles: Map<string, string>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl bg-surface shadow-[var(--shadow-border)]">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <caption className="sr-only">
          One row per billing period, with the amount, the status, and the dates the report was
          written, the customer was emailed, and the money was collected.
        </caption>
        <thead className="text-xs uppercase tracking-[0.14em] text-muted">
          <tr className="border-b border-border">
            <th scope="col" className="px-4 py-3 font-medium">
              Customer
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Plan
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Period
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-right">
              Amount
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Reported
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Emailed
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Paid
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">{row.companyName}</td>
              <td className="px-4 py-3">{planTitles.get(row.planId) ?? row.planId}</td>
              <td className="px-4 py-3 text-muted">
                {formatDate(row.periodStart)} – {formatDate(row.periodEnd)}
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">
                {formatZar(row.amountCents)}
              </td>
              <td className="px-4 py-3">
                <Badge variant={cycleBadge(row.status)}>{cycleStatusLabel(row.status)}</Badge>
              </td>
              <td className="px-4 py-3 text-muted">{stamp(row.fulfilledAt)}</td>
              <td className="px-4 py-3 text-muted">{stamp(row.notifiedAt)}</td>
              <td className="px-4 py-3 text-muted">{stamp(row.paidAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NoticesTable({ rows }: { rows: NoticeRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-surface shadow-[var(--shadow-border)]">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <caption className="sr-only">
          Every email the office has sent to a customer, with its template, recipient, subject and
          delivery outcome.
        </caption>
        <thead className="text-xs uppercase tracking-[0.14em] text-muted">
          <tr className="border-b border-border">
            <th scope="col" className="px-4 py-3 font-medium">
              Date
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Customer
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Template
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Recipient
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Subject
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Detail
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = noticeStatus(row.status);
            const failed = status === "not_delivered";
            return (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-muted">{formatDateTime(row.createdAt)}</td>
                <td className="px-4 py-3">{row.companyName ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.template}</td>
                <td className="px-4 py-3 text-muted">{row.recipient}</td>
                <td className="px-4 py-3">{row.subject}</td>
                <td className="px-4 py-3">
                  <Badge variant={noticeBadge(status)}>{noticeStatusLabel(status)}</Badge>
                  {row.sentAt ? (
                    <p className="mt-1 text-xs text-muted">Sent {formatDate(row.sentAt)}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {failed && row.detail ? (
                    <span className="text-danger">{row.detail}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function stamp(iso: string | null): string {
  return iso ? formatDate(iso) : "—";
}

function cycleLabel(cycle: string): string {
  if (cycle === "monthly") return "Monthly";
  if (cycle === "quarterly") return "Quarterly";
  if (cycle === "once") return "One-off";
  return cycle;
}

function subscriptionLabel(status: SubscriptionStatus): string {
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  if (status === "cancelled") return "Ended";
  return "Completed";
}

function subscriptionBadge(status: SubscriptionStatus): "default" | "ok" | "warn" | "danger" {
  if (status === "active") return "ok";
  if (status === "paused") return "warn";
  if (status === "cancelled") return "danger";
  return "default";
}

function cycleStatusLabel(status: BillingCycleStatus): string {
  if (status === "invoiced") return "Invoiced";
  if (status === "notified") return "Emailed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function cycleBadge(status: BillingCycleStatus): "default" | "accent" | "ok" | "danger" {
  if (status === "paid") return "ok";
  if (status === "fulfilled" || status === "notified") return "accent";
  if (status === "cancelled") return "danger";
  return "default";
}

function noticeStatus(value: string): NoticeStatus {
  if (value === "sent") return "sent";
  if (value === "not_delivered") return "not_delivered";
  return "approved_unsent";
}

function noticeStatusLabel(status: NoticeStatus): string {
  if (status === "sent") return "Sent";
  if (status === "not_delivered") return "Not delivered";
  return "Approved · not sent";
}

function noticeBadge(status: NoticeStatus): "ok" | "warn" | "danger" {
  if (status === "sent") return "ok";
  if (status === "not_delivered") return "danger";
  return "warn";
}
