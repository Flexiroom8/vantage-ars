import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PublicFrame } from "@/components/public/site-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { answerCustomerQuote, getCustomerQuote } from "@/lib/office/api";
import { formatZar } from "@/lib/office/money";

export const Route = createFileRoute("/q/$token")({
  head: () => ({
    meta: [
      { title: "Your quote · Vantage-ARS" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  loader: ({ params }) => getCustomerQuote({ data: { token: params.token } }),
  component: CustomerQuotePage,
});

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" }).format(
    new Date(value),
  );
}

const STATE_COPY = {
  open: { label: "Waiting on you", variant: "warn" },
  accepted: { label: "Accepted", variant: "ok" },
  declined: { label: "Declined", variant: "default" },
  expired: { label: "Expired", variant: "danger" },
  closed: { label: "Closed", variant: "default" },
  revoked: { label: "Withdrawn", variant: "danger" },
} as const;

function CustomerQuotePage() {
  const quote = Route.useLoaderData();
  const { token } = Route.useParams();
  const [answered, setAnswered] = useState<"accepted" | "declined" | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  if (!quote.ok) {
    return (
      <PublicFrame>
        <section className="mx-auto max-w-2xl py-20">
          <p className="text-sm text-accent">Quote link</p>
          <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">We can't open this quote.</h1>
          <p className="mt-4 text-muted">{quote.error}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/support" className="inline-flex h-11 items-center rounded-md bg-accent px-5 text-sm font-medium text-accent-fg">
              Contact the service desk
            </Link>
            <Link to="/" className="inline-flex h-11 items-center rounded-md px-5 text-sm shadow-[var(--shadow-border)]">
              Back to the site
            </Link>
          </div>
        </section>
      </PublicFrame>
    );
  }

  const state = (answered ?? (quote as { state: keyof typeof STATE_COPY }).state) as keyof typeof STATE_COPY;
  const copy = STATE_COPY[state] ?? STATE_COPY.open;

  async function downloadPdf() {
    if (!quote.ok) return;
    setPdfError(null);
    try {
      const { buildQuotePdf, downloadPdf: save, quotePdfName } = await import("@/lib/office/quote-pdf");
      const bytes = await buildQuotePdf({
        companyName: quote.companyName,
        amount: formatZar(quote.amountCents),
        body: quote.scope,
        payment: quote.paymentNote,
      });
      save(bytes, quotePdfName(quote.companyName, quote.scope));
    } catch {
      setPdfError("The PDF could not be built. Try again, or contact the service desk.");
    }
  }

  return (
    <PublicFrame>
      <section className="mx-auto max-w-3xl py-12 sm:py-16">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-accent">Written quote{quote.reference ? ` · ${quote.reference}` : ""}</p>
          <Badge variant={copy.variant}>{copy.label}</Badge>
        </div>
        <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">Quote for {quote.companyName}</h1>
        <p className="mt-3 text-sm text-muted">
          Issued {formatDate(quote.issuedAt)}
          {state === "open" ? ` · valid until ${formatDate(quote.expiresAt)}` : ""}
        </p>

        <div className="mt-10 rounded-xl bg-surface p-6 shadow-[var(--shadow-border)] sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Quoted total</p>
              <p className="mt-2 font-mono text-4xl tabular-nums">{formatZar(quote.amountCents)}</p>
              <p className="mt-1 text-xs text-subtle">South African rand. VAT only applies if the scope below says so.</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => void downloadPdf()}>
              Download PDF
            </Button>
          </div>
          {pdfError ? (
            <p role="alert" className="pt-4 text-sm text-danger">
              {pdfError}
            </p>
          ) : null}
          <div className="pt-6">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Scope</p>
            <p className="mt-3 whitespace-pre-line leading-relaxed">{quote.scope}</p>
          </div>
          {quote.paymentNote ? (
            <div className="mt-6 border-t border-border pt-6">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">How to pay</p>
              <p className="mt-3 text-sm text-muted">{quote.paymentNote}</p>
              <p className="mt-2 text-xs text-subtle">Pay only after we confirm the job and send the invoice.</p>
            </div>
          ) : null}
        </div>

        {state === "open" ? (
          <AnswerForm token={token} onDone={setAnswered} />
        ) : (
          <div className="mt-8 rounded-xl bg-raised p-6">
            {state === "accepted" ? (
              <>
                <h2 className="font-serif text-2xl">Thank you. The quote is accepted.</h2>
                <p className="mt-2 text-sm text-muted">
                  {quote.answerName && !answered ? `Accepted by ${quote.answerName}. ` : ""}
                  We'll be in touch to schedule the work. The invoice follows from us directly.
                </p>
              </>
            ) : state === "declined" ? (
              <>
                <h2 className="font-serif text-2xl">The quote was declined.</h2>
                <p className="mt-2 text-sm text-muted">Nothing is owed. If something changes, ask us for a new quote any time.</p>
              </>
            ) : (
              <>
                <h2 className="font-serif text-2xl">This quote can no longer be answered here.</h2>
                <p className="mt-2 text-sm text-muted">Ask us for a fresh quote and we'll send a new link.</p>
              </>
            )}
          </div>
        )}
      </section>
    </PublicFrame>
  );
}

function AnswerForm({ token, onDone }: { token: string; onDone: (outcome: "accepted" | "declined") => void }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [agree, setAgree] = useState(false);
  const [pending, setPending] = useState<"accepted" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(outcome: "accepted" | "declined", event?: FormEvent) {
    event?.preventDefault();
    setError(null);
    setPending(outcome);
    try {
      const result = await answerCustomerQuote({ data: { token, outcome, name, note, agree } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone(outcome);
    } catch {
      setError("Your answer could not be sent. Try again, or contact the service desk.");
    } finally {
      setPending(null);
    }
  }

  return (
    <form className="mt-8 grid gap-5 rounded-xl bg-surface p-6 shadow-[var(--shadow-border)] sm:p-8" onSubmit={(event) => void send("accepted", event)}>
      <div>
        <h2 className="font-serif text-2xl">Your answer</h2>
        <p className="mt-1 text-sm text-muted">Accepting asks us to schedule the work at this price. Nothing is charged here.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="quote-name">Your full name</Label>
        <Input id="quote-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="quote-note">Note (optional)</Label>
        <Textarea
          id="quote-note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Preferred dates, site access, or why it doesn't suit."
        />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-[var(--color-accent)]" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
        <span>
          I accept this quote and the{" "}
          <Link to="/terms" className="underline underline-offset-4">
            terms of work
          </Link>
          .
        </span>
      </label>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending !== null || !agree || name.trim().length < 2}>
          {pending === "accepted" ? "Sending…" : "Accept quote"}
        </Button>
        <Button type="button" variant="secondary" disabled={pending !== null || name.trim().length < 2} onClick={() => void send("declined")}>
          {pending === "declined" ? "Sending…" : "Decline"}
        </Button>
      </div>
    </form>
  );
}
