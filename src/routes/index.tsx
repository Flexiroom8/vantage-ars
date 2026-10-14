import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PublicFrame } from "@/components/public/site-frame";
import { LiveField, PathExhibit } from "@/components/public/live-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitPublicEnquiry, submitPaymentNotice, getPaymentMethods } from "@/lib/office/api";
import { SERVICE_PAGES } from "@/lib/site/services";
import { SERVICE_LINES, publicRateRows } from "@/lib/office/catalogue";
import { businessJsonLd, faqJsonLd, pageHead, SITE_URL, jsonLd } from "@/lib/site/seo";

export const Route = createFileRoute("/")({
  head: () => {
    const head = pageHead({
      title: "VoIP, networking & IT infrastructure · Vantage-ARS",
      description:
        "Worldwide remote VoIP, networking and IT infrastructure support from Vantage-ARS, with clear ZAR pricing and a written quote before work starts.",
      path: "/",
    });
    return {
      ...head,
      scripts: [
        businessJsonLd(),
        faqJsonLd([
          { q: "How do I get a quote?", a: "Send the enquiry form. You get a written quote with scope and total before anyone starts." },
          { q: "Do you charge VAT?", a: "VAT is added only when the written quote says so." },
          { q: "Do you offer managed support?", a: "No. There is no retainer or SLA — you pay for agreed work." },
        ]),
        jsonLd({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Vantage-ARS",
          url: SITE_URL,
        }),
      ],
    };
  },
  loader: () => getPaymentMethods(),
  component: HomePage,
});

function HomePage() {
  const payment = Route.useLoaderData();
  const rates = publicRateRows();
  return (
    <PublicFrame>
      <LiveField />
      <section className="enter-up relative pb-16 pt-16 lg:pt-24">
        <p className="font-mono text-sm text-accent">VoIP · Networking · IT infrastructure</p>
        <h1 className="mt-4 max-w-4xl font-serif text-5xl leading-[0.96] tracking-[-0.04em] sm:text-7xl">
          Clear scope. Written quote. No surprises.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Worldwide remote support from R690 an hour, on-site by arrangement from R805 an hour.
          You see the scope, timing and total in writing before anyone starts.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/"
            hash="enquiry"
            className="inline-flex h-11 items-center rounded-md bg-accent px-5 text-sm font-medium text-accent-fg"
          >
            Get a written quote
          </Link>
          <Link
            to="/rates"
            className="inline-flex h-11 items-center rounded-md px-5 text-sm shadow-[var(--shadow-border)]"
          >
            See published rates
          </Link>
        </div>
        <PathExhibit />
      </section>

      <section id="services" className="border-t border-border py-16" aria-label="Services">
        <h2 className="font-serif text-4xl tracking-[-0.03em]">Services</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {SERVICE_LINES.map((line) => (
            <div
              key={line.number}
              className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-border)]"
            >
              <p className="font-mono text-sm text-accent">{line.number}</p>
              <h3 className="mt-2 font-serif text-2xl">{line.title}</h3>
              <p className="mt-2 text-sm text-muted">{line.summary}</p>
              <p className="mt-3 font-mono text-sm">{line.price}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {SERVICE_PAGES.map((page) => (
            <Link
              key={page.slug}
              to="/services/$slug"
              params={{ slug: page.slug }}
              className="rounded-xl p-5 shadow-[var(--shadow-border)] hover:bg-raised"
            >
              <p className="font-mono text-xs text-accent">{page.number}</p>
              <p className="mt-1 font-serif text-xl">{page.title}</p>
              <p className="mt-1 text-sm text-muted">{page.description.slice(0, 110)}…</p>
            </Link>
          ))}
        </div>
      </section>

      <section id="prices" className="border-t border-border py-16" aria-label="Prices">
        <h2 className="font-serif text-4xl tracking-[-0.03em]">Published rates</h2>
        <p className="mt-3 max-w-xl text-sm text-muted">
          South African rand. VAT is added only when the written quote says so.{" "}
          <Link to="/rates" className="text-fg underline-offset-4 hover:underline">
            Full rate sheet
          </Link>
          .
        </p>
        <ul className="mt-8 border-t border-fg/20">
          {rates.slice(0, 6).map((rate) => (
            <li
              key={rate.id}
              className="grid gap-2 border-b border-fg/15 py-5 sm:grid-cols-[1fr_9rem] sm:gap-8"
            >
              <div>
                <h3 className="text-base font-medium">{rate.title}</h3>
                <p className="mt-1 text-sm text-muted">{rate.scope}</p>
              </div>
              <p className="font-mono text-sm sm:text-right">{rate.price}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="enquiry" className="border-t border-border py-16" aria-label="Enquiry">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <h2 className="font-serif text-4xl tracking-[-0.03em]">Ask for a quote</h2>
            <p className="mt-3 max-w-md text-sm text-muted">
              A few sentences are enough. This is not a contract — you get a written quote first.
            </p>
          </div>
          <EnquiryForm />
        </div>
      </section>

      <section id="payment" className="border-t border-border py-16" aria-label="Payment">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <h2 className="font-serif text-4xl tracking-[-0.03em]">Paid already? Tell us.</h2>
            <p className="mt-3 max-w-md text-sm text-muted">
              Send the reference from your quote or invoice. This records your notice — it is not
              an automatic receipt.
            </p>
            {Array.isArray(payment) && payment.every((m: { detail: string }) => m.detail.includes("sent with")) ? (
              <p className="mt-4 text-xs text-subtle">
                Bank details are sent with your quote or invoice.
              </p>
            ) : null}
          </div>
          <PaymentForm />
        </div>
      </section>
    </PublicFrame>
  );
}

function EnquiryForm() {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", message: "", website: "" });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await submitPublicEnquiry({ data: form });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    } catch {
      setError("The enquiry could not be sent. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
        <p className="font-serif text-3xl">Received.</p>
        <p className="mt-3 text-sm text-muted">
          Your enquiry is recorded. You will get a written quote before any work is agreed.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <div>
        <Label htmlFor="enquiry-name">Your name</Label>
        <Input
          id="enquiry-name"
          className="mt-2"
          autoComplete="name"
          required
          minLength={2}
          maxLength={160}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="enquiry-email">Email address</Label>
        <Input
          id="enquiry-email"
          type="email"
          className="mt-2"
          autoComplete="email"
          required
          maxLength={254}
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="enquiry-message">What do you need?</Label>
        <Textarea
          id="enquiry-message"
          className="mt-2"
          required
          minLength={5}
          maxLength={3000}
          rows={5}
          placeholder="What stopped working, or what you want set up."
          value={form.message}
          onChange={(event) => setForm({ ...form, message: event.target.value })}
        />
      </div>
      <div className="h-0 overflow-hidden" aria-hidden="true">
        Leave this field empty
        <input
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(event) => setForm({ ...form, website: event.target.value })}
        />
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Sending…" : "Request a quote"}
      </Button>
    </form>
  );
}

function PaymentForm() {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", reference: "", amount: "", website: "" });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await submitPaymentNotice({ data: form });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    } catch {
      setError("The notice could not be recorded. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
        <p className="font-serif text-3xl">Noted.</p>
        <p className="mt-3 text-sm text-muted">
          Your payment notice is recorded. A receipt follows after it is checked.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pay-name">Name on payment</Label>
          <Input
            id="pay-name"
            className="mt-2"
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="pay-email">Email</Label>
          <Input
            id="pay-email"
            type="email"
            className="mt-2"
            required
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pay-ref">Reference (VA-…)</Label>
          <Input
            id="pay-ref"
            className="mt-2"
            required
            placeholder="VA-XXXX"
            value={form.reference}
            onChange={(event) => setForm({ ...form, reference: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="pay-amount">Amount (R)</Label>
          <Input
            id="pay-amount"
            className="mt-2"
            required
            inputMode="decimal"
            placeholder="690.00"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
          />
        </div>
      </div>
      <div className="h-0 overflow-hidden" aria-hidden="true">
        Leave this field empty
        <input
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(event) => setForm({ ...form, website: event.target.value })}
        />
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Sending…" : "Notify payment"}
      </Button>
    </form>
  );
}
