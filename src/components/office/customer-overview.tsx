import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCustomers } from "@/lib/office/api";
import type { CustomerBook } from "@/lib/office/customers";
import { formatZar } from "@/lib/office/format";

export function CustomerOverview() {
  const [book, setBook] = useState<CustomerBook | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getCustomers()
      .then((result) => {
        if (!cancelled) setBook(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
            Customer workspace
          </p>
          <h2 className="mt-1 font-serif text-2xl text-fg">Customer portfolio</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            A live view assembled from recorded enquiries, sales, invoices, receipts and plans.
            Agents keep records current; customer commitments and spending remain behind founder
            approval.
          </p>
        </div>
        <Link
          to="/office/customers"
          className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-fg hover:bg-raised"
        >
          Open customer book
        </Link>
      </div>

      {error ? (
        <p role="status" className="mt-5 rounded-lg bg-warn/10 px-4 py-3 text-sm text-warn">
          The portfolio summary could not be loaded. Open the customer book to retry.
        </p>
      ) : !book ? (
        <p aria-live="polite" className="mt-5 text-sm text-muted">
          Reading customer records…
        </p>
      ) : book.accounts.length === 0 ? (
        <p className="mt-5 rounded-lg border border-border bg-bg/30 px-4 py-3 text-sm text-muted">
          No customer records yet. New enquiries and approved business records populate this view
          automatically.
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-2 xl:grid-cols-4">
            <PortfolioMetric label="Clients" value={String(book.summary.clients)} />
            <PortfolioMetric label="Prospects" value={String(book.summary.prospects)} />
            <PortfolioMetric
              label="Monthly recurring"
              value={formatZar(book.summary.monthlyRecurringCents)}
            />
            <PortfolioMetric
              label="Needs attention"
              value={String(book.summary.churnRisk)}
              detail={`${formatZar(book.summary.overdueCents)} overdue`}
              warn={book.summary.churnRisk > 0 || book.summary.overdueCents > 0}
            />
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Priority accounts
              </h3>
              <Link
                to="/office/customers"
                className="text-xs text-accent underline-offset-4 hover:underline"
              >
                Search all accounts
              </Link>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {book.accounts.slice(0, 4).map((account) => (
                <li
                  key={account.companyName}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{account.companyName}</p>
                    <p className="mt-1 text-xs text-muted">
                      {account.status === "client"
                        ? "Client"
                        : account.status === "lost"
                          ? "Lost"
                          : "Prospect"}
                      {account.openOpportunities > 0
                        ? ` · ${account.openOpportunities} open opportunity${account.openOpportunities === 1 ? "" : "ies"}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {account.churnRisk ? <Badge variant="warn">Needs attention</Badge> : null}
                    {account.overdueCents > 0 ? (
                      <span className="text-xs text-danger">
                        {formatZar(account.overdueCents)} overdue
                      </span>
                    ) : account.outstandingCents > 0 ? (
                      <span className="text-xs text-muted">
                        {formatZar(account.outstandingCents)} outstanding
                      </span>
                    ) : account.pipelineCents > 0 ? (
                      <span className="text-xs text-muted">
                        {formatZar(account.pipelineCents)} pipeline
                      </span>
                    ) : (
                      <span className="text-xs text-muted">No open balance</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <Link to="/office/inbox" className="text-accent underline-offset-4 hover:underline">
              Review enquiries
            </Link>
            <Link to="/office/sales" className="text-accent underline-offset-4 hover:underline">
              Open pipeline
            </Link>
            <Link to="/office/ledger" className="text-accent underline-offset-4 hover:underline">
              Review accounts receivable
            </Link>
          </div>
        </>
      )}
    </Card>
  );
}

function PortfolioMetric({
  label,
  value,
  detail,
  warn = false,
}: {
  label: string;
  value: string;
  detail?: string;
  warn?: boolean;
}) {
  return (
    <div className="bg-surface p-4">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={`mt-2 font-mono text-xl tabular-nums ${warn ? "text-warn" : "text-fg"}`}>
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs text-subtle">{detail}</p> : null}
    </div>
  );
}
