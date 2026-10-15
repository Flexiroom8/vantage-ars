import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/site/seo";
import { useState, type FormEvent } from "react";
import { PublicFrame } from "@/components/public/site-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitPublicEnquiry } from "@/lib/office/api";

export const Route = createFileRoute("/support")({
  head: () =>
    pageHead({
      title: "Customer service · Vantage-ARS",
      description:
        "Log a fault, a question about work in progress, or a complaint with Vantage-ARS. A short acknowledgement is sent when the matter is received.",
      path: "/support",
    }),
  component: SupportDesk,
});

const MATTERS = [
  { value: "fault", label: "Something is not working" },
  { value: "question", label: "A question about work in progress" },
  { value: "complaint", label: "A complaint" },
] as const;

const FAQS = [
  { q: "Does this form create a new quote or refund?", a: "No. It records a matter for review. No refund, cancellation, or price change is created here." },
  { q: "Can I use this for a new job?", a: "Use the enquiry form from the homepage if you need a written quote for new work." },
  { q: "Do I need to include passwords or access keys?", a: "No. Please do not include credentials, card numbers, or private credentials in any message." },
] as const;

function SupportDesk() {
  return (
    <PublicFrame>
      <section className="enter-up grid gap-10 border-b border-border py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <p className="text-sm font-medium text-accent">Customer service</p>
          <h1 className="mt-4 max-w-xl font-serif text-5xl leading-[0.96] tracking-[-0.04em] sm:text-6xl">
            Already a customer? This is the right place.
          </h1>
          <p className="mt-6 max-w-lg text-base text-muted">
            Tell us about a fault, a job already underway, or a complaint. We may send a short
            acknowledgement. It does not refund anything, cancel work, or change a price.
          </p>
        </div>

        <dl className="self-end space-y-4 border-t border-border pt-6 text-sm lg:border-t-0 lg:pt-0">
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-subtle">What this desk does</dt>
            <dd className="mt-1 text-muted">Records the matter for a person to review.</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-subtle">What it does not do</dt>
            <dd className="mt-1 text-muted">No refund, no new price, and no contract from this form.</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-subtle">New work</dt>
            <dd className="mt-1 text-muted">
              <Link to="/" hash="enquiry" className="underline-offset-4 hover:underline">
                Use the enquiry form
              </Link>{" "}
              if you need a quote.
            </dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-4 border-b border-border py-10 md:grid-cols-3">
        {[
          ["A fault", "Something stopped. Say what it was doing, and what it does now."],
          ["Work in progress", "Ask where an agreed job stands. This does not change the quote."],
          ["A complaint", "Say what went wrong. A refund or a credit is not decided on this form."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-serif text-3xl">{title}</h2>
            <p className="mt-3 text-sm text-muted">{body}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-10 py-16 lg:grid-cols-[1fr_0.9fr]">
        <DeskForm />
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-border)]">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Need a quick check?</p>
          <h2 className="mt-3 font-serif text-3xl">Before you send the desk a note</h2>
          <ul className="mt-6 space-y-4 text-sm text-muted">
            <li className="border-b border-fg/10 pb-3">Include what stopped working, when it started, and what you have already tried.</li>
            <li className="border-b border-fg/10 pb-3">Add the customer or site name so the team can trace the work quickly.</li>
            <li>Keep the message factual. Avoid passwords, remote access keys, or payment details.</li>
          </ul>
        </div>
      </section>

      <section className="border-t border-border py-16" aria-labelledby="support-faq-heading">
        <h2 id="support-faq-heading" className="font-serif text-4xl tracking-[-0.03em]">
          Common questions
        </h2>
        <div className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2">
          {FAQS.map((item) => (
            <div key={item.q} className="border-t border-fg/15 pt-5">
              <h3 className="text-sm font-medium">{item.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicFrame>
  );
}

function DeskForm() {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    message: "",
    website: "",
    matter: "fault",
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await submitPublicEnquiry({
        data: { ...form, desk: true },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    } catch {
      setError("The desk could not record this. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      {done ? (
        <div className="rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
          <p className="font-serif text-3xl">Recorded.</p>
          <p className="mt-3 text-sm text-muted">
            Recorded. If mail is connected, a short acknowledgement is sent. Nothing has been refunded, cancelled, or quoted.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <div>
            <Label htmlFor="desk-name">Your name</Label>
            <Input
              id="desk-name"
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
            <Label htmlFor="desk-email">Email address</Label>
            <Input
              id="desk-email"
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
            <Label htmlFor="desk-matter">What is this about?</Label>
            <Select
              id="desk-matter"
              className="mt-2"
              value={form.matter}
              onChange={(event) => setForm({ ...form, matter: event.target.value })}
            >
              {MATTERS.map((matter) => (
                <option key={matter.value} value={matter.value}>
                  {matter.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="desk-message">What should we know?</Label>
            <Textarea
              id="desk-message"
              className="mt-2"
              required
              minLength={5}
              maxLength={3000}
              rows={6}
              placeholder="What stopped working, or what you need an update on."
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
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Sending…" : "Send to the desk"}
          </Button>
        </form>
      )}
    </section>
  );
}
