import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useOfficeSnapshot } from "@/components/office/office-context";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { DispatchPanel } from "@/components/office/dispatch-panel";
import { EmptyState } from "@/components/office/empty-state";
import { PageHeader } from "@/components/office/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createCustomerQuoteLink,
  fileQuote,
  listCustomerQuoteLinks,
  recordCustomerAnswer,
  revokeCustomerQuoteLink,
} from "@/lib/office/api";
import type { QuoteLinkSummary } from "@/lib/office/quote-link";
import { customerQuoteText, withPaymentNote } from "@/lib/office/invoice";
import { formatZar } from "@/lib/office/money";
import { priceQuote, QUOTE_SPECS } from "@/lib/office/quote";

export const Route = createFileRoute("/office/sales")({
  component: SalesPage,
});


function SalesPage() {
  const snapshot = useOfficeSnapshot();
  const stages = ["discovery", "proposal", "negotiation", "won", "lost"] as const;
  const open = snapshot.opportunities.filter((item) => item.stage !== "won" && item.stage !== "lost");

  return (
    <div className="enter-up mx-auto max-w-6xl">
      <PageHeader
        kicker="Sales · CLOSE"
        title="Pipeline only after you say so."
        description="CLOSE prices published labour only. The copy includes how to pay. A quote waits on you and is not sent. Winning or losing still returns to your desk."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <DispatchPanel
          lockedAgent="close"
          placeholder="Advance an approved opportunity. Propose a close — do not close without the founder."
        />
        <Card>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Open pipeline</p>
          <p className="mt-2 font-mono text-3xl tabular-nums">
            {formatZar(snapshot.opportunities.filter((o) => o.stage !== "lost").reduce((s, o) => s + o.valueCents, 0))}
          </p>
          <p className="mt-1 text-sm text-muted">Won and in-flight value. Lost work is excluded.</p>
        </Card>
      </div>

      {open.length > 0 ? <QuoteForm opportunities={open} /> : null}
      <ApprovedQuotes
        quotes={snapshot.documents.filter((item) => item.kind === "quote" && item.status === "approved_unsent")}
        opportunities={snapshot.opportunities}
        paymentNote={snapshot.company.paymentInstructions}
      />

      {snapshot.opportunities.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No sales work yet"
            body="Marketing must qualify a company and you must approve the handoff before CLOSE may price anything."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {stages.map((stage) => {
            const items = snapshot.opportunities.filter((o) => o.stage === stage);
            return (
              <div key={stage} className="rounded-xl bg-surface p-3 shadow-[var(--shadow-border)]">
                <p className="px-1 text-xs uppercase tracking-[0.16em] text-muted">{stage}</p>
                <div className="mt-2 space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="rounded-md bg-raised p-3">
                      <p className="text-sm">{item.companyName}</p>
                      <p className="font-mono text-xs tabular-nums text-muted">{formatZar(item.valueCents)}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-subtle">{item.summary}</p>
                    </div>
                  ))}
                  {items.length === 0 ? <p className="px-1 py-6 text-xs text-subtle">Empty</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuoteForm({
  opportunities,
}: {
  opportunities: { id: string; companyName: string; stage: string }[];
}) {
  const router = useRouter();
  const [opportunityId, setOpportunityId] = useState(opportunities[0]?.id ?? "");
  const [specKey, setSpecKey] = useState(`${QUOTE_SPECS[0].rateId}:${QUOTE_SPECS[0].location}`);
  const spec = QUOTE_SPECS.find((item) => `${item.rateId}:${item.location}` === specKey) ?? QUOTE_SPECS[0];
  const [quantity, setQuantity] = useState(spec.unit === "flat" ? "1" : String(spec.min));
  const [pending, setPending] = useState(false);
  const priced = priceQuote({
    rateId: spec.rateId,
    location: spec.location,
    quantity: spec.unit === "flat" ? 1 : Number(quantity),
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await fileQuote({
        data: {
          opportunityId,
          rateId: spec.rateId,
          location: spec.location,
          quantity: spec.unit === "flat" ? 1 : Number(quantity),
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Quote is on your approvals desk. It has not been sent.");
      await router.invalidate();
    } catch {
      toast.error("The quote could not be filed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mt-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">Draft a quote</p>
      <h2 className="mt-2 font-serif text-2xl">Published labour only.</h2>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="quote-company">Opportunity</Label>
          <Select
            id="quote-company"
            className="mt-2"
            value={opportunityId}
            onChange={(event) => setOpportunityId(event.target.value)}
          >
            {opportunities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.companyName} · {item.stage}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="quote-line">Published line</Label>
          <Select
            id="quote-line"
            className="mt-2"
            value={specKey}
            onChange={(event) => {
              const next = QUOTE_SPECS.find((item) => `${item.rateId}:${item.location}` === event.target.value);
              setSpecKey(event.target.value);
              if (next) setQuantity(next.unit === "flat" ? "1" : String(next.min));
            }}
          >
            {QUOTE_SPECS.map((item) => (
              <option key={`${item.rateId}:${item.location}`} value={`${item.rateId}:${item.location}`}>
                {item.title}
              </option>
            ))}
          </Select>
        </div>
        {spec.unit === "flat" ? (
          <p className="text-sm text-muted sm:col-span-2">{spec.note}</p>
        ) : (
          <div>
            <Label htmlFor="quote-qty">{spec.unit === "point" ? "Points" : "Hours"}</Label>
            <input
              id="quote-qty"
              className="mt-2 flex h-11 w-full rounded-md bg-raised px-3 font-mono text-sm text-fg shadow-[var(--shadow-border)]"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
            <p className="mt-2 text-xs text-subtle">{spec.note}</p>
          </div>
        )}
        <div className="flex flex-col justify-end gap-3">
          <p className="font-mono text-2xl tabular-nums">{priced.ok ? formatZar(priced.cents) : "—"}</p>
          {!priced.ok ? <p className="text-sm text-danger">{priced.error}</p> : null}
          <Badge variant="warn">Not sent</Badge>
          <Button type="submit" disabled={pending || !priced.ok}>
            {pending ? "Filing…" : "File for your approval"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ApprovedQuotes({
  quotes,
  opportunities,
  paymentNote,
}: {
  quotes: { id: string; title: string; summary: string; relatedId: string | null }[];
  opportunities: { id: string; companyName: string; valueCents: number }[];
  paymentNote: string;
}) {
  const [links, setLinks] = useState<QuoteLinkSummary[]>([]);
  const quoteKey = quotes.map((quote) => quote.id).join(",");
  const reloadLinks = () =>
    listCustomerQuoteLinks()
      .then(setLinks)
      .catch(() => setLinks([]));
  useEffect(() => {
    if (quoteKey) void reloadLinks();
  }, [quoteKey]);
  if (quotes.length === 0) return null;
  return (
    <div className="mt-8 space-y-3">
      <h2 className="font-serif text-2xl">Approved quotes</h2>
      <p className="text-sm text-muted">
        Copy one and send it yourself, or create a customer link where they can read it, download the PDF and accept or decline. Nothing on this desk is emailed.
      </p>
      {quotes.map((quote) => (
        <QuoteCard
          key={quote.id}
          quote={quote}
          paymentNote={paymentNote}
          opportunity={opportunities.find((item) => item.id === quote.relatedId)}
          link={links.find((item) => item.documentId === quote.id)}
          onLinksChanged={() => void reloadLinks()}
        />
      ))}
    </div>
  );
}

function QuoteCard({
  quote,
  opportunity,
  paymentNote,
  link,
  onLinksChanged,
}: {
  quote: { id: string; title: string; summary: string; relatedId: string | null };
  opportunity?: { id: string; companyName: string; valueCents: number };
  paymentNote: string;
  link?: QuoteLinkSummary;
  onLinksChanged: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"won" | "lost" | null>(null);
  const text = withPaymentNote(customerQuoteText(quote.summary), paymentNote);

  async function answer(outcome: "won" | "lost") {
    if (!opportunity) return;
    setPending(outcome);
    try {
      const result = await recordCustomerAnswer({ data: { opportunityId: opportunity.id, outcome } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        outcome === "won"
          ? "Recorded as accepted. Technical has the job. No email was sent."
          : "Recorded as declined. No email was sent.",
      );
      await router.invalidate();
    } catch {
      toast.error("The answer could not be recorded.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm">{opportunity?.companyName ?? quote.title}</p>
          <p className="mt-1 font-mono text-2xl tabular-nums">
            {opportunity ? formatZar(opportunity.valueCents) : "—"}
          </p>
        </div>
        <Badge variant="warn">Not emailed</Badge>
      </div>
      <p className="mt-4 text-sm text-muted">{text}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void navigator.clipboard.writeText(text).then(
              () => toast.success("Copied. Send it yourself. It has not been emailed."),
              () => toast.error("Could not copy. Select the quote text instead."),
            );
          }}
        >
          Copy quote
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void (async () => {
              const { buildQuotePdf, downloadPdf, quotePdfName } = await import("@/lib/office/quote-pdf");
              const scope = customerQuoteText(quote.summary);
              const bytes = await buildQuotePdf({
                companyName: opportunity?.companyName ?? quote.title,
                amount: opportunity ? formatZar(opportunity.valueCents) : "-",
                body: scope,
                payment: paymentNote,
              });
              downloadPdf(bytes, quotePdfName(opportunity?.companyName ?? quote.title, scope));
              toast.success("PDF saved. Send it yourself. It has not been emailed.");
            })().catch(() => toast.error("The PDF could not be created."));
          }}
        >
          Download PDF
        </Button>
        <Button type="button" disabled={!opportunity || pending !== null} onClick={() => void answer("won")}>
          {pending === "won" ? "Recording…" : "Customer accepted"}
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={!opportunity || pending !== null}
          onClick={() => void answer("lost")}
        >
          {pending === "lost" ? "Recording…" : "Customer declined"}
        </Button>
      </div>
      <CustomerLinkPanel documentId={quote.id} link={link} onChanged={onLinksChanged} />
    </Card>
  );
}
function linkDate(value: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(value));
}

function CustomerLinkPanel({
  documentId,
  link,
  onChanged,
}: {
  documentId: string;
  link?: QuoteLinkSummary;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const active = link?.state === "open";

  async function create() {
    setBusy(true);
    try {
      const result = await createCustomerQuoteLink({ data: { documentId } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const url = `${window.location.origin}/q/${result.token}`;
      setFresh(url);
      await navigator.clipboard.writeText(url).then(
        () => toast.success("Link copied. Send it to the customer yourself. It is shown only once."),
        () => toast.success("Link created. Copy it now. It is shown only once."),
      );
      onChanged();
    } catch {
      toast.error("The link could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      const result = await revokeCustomerQuoteLink({ data: { documentId } });
      if (!result.ok) toast.error(result.error);
      else {
        setFresh(null);
        toast.success("Link withdrawn. The customer can no longer open it.");
      }
      onChanged();
    } catch {
      toast.error("The link could not be withdrawn.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Customer link</p>
          <p className="mt-1 text-sm text-muted">
            {!link
              ? "No link yet."
              : active
                ? `Open until ${linkDate(link.expiresAt)} · ${
                    link.viewCount > 0 ? `viewed ${link.viewCount}× (last ${linkDate(link.lastViewedAt ?? link.createdAt)})` : "not opened yet"
                  }`
                : link.state === "revoked"
                  ? "Withdrawn."
                  : link.state === "expired"
                    ? "Expired. Create a new link if the price still stands."
                    : `Closed (${link.state}).`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void create()}>
            {active ? "Replace link" : "Create link"}
          </Button>
          {active ? (
            <Button type="button" variant="danger" disabled={busy} onClick={() => void revoke()}>
              Withdraw
            </Button>
          ) : null}
        </div>
      </div>
      {fresh ? (
        <p className="mt-3 break-all rounded-md bg-raised px-3 py-2 font-mono text-xs" aria-live="polite">
          {fresh}
        </p>
      ) : null}
    </div>
  );
}
