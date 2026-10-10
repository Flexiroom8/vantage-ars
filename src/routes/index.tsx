import { createFileRoute, Link } from "@tanstack/react-router";
import { businessJsonLd, faqJsonLd, pageHead } from "@/lib/site/seo";
import { useState, type FormEvent } from "react";
import { PublicFrame } from "@/components/public/site-frame";
import { PathExhibit } from "@/components/public/live-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { publicRateRows, SERVICE_LINES } from "@/lib/office/catalogue";
import { SERVICE_PAGES } from "@/lib/site/services";
import { getPaymentMethods, submitPaymentNotice, submitPublicEnquiry } from "@/lib/office/api";

export const Route = createFileRoute("/")({
  head: () => ({
    ...pageHead({ title: "Vantage-ARS · VoIP, Networking & IT Infrastructure", description: "Get the phones and the network working again. Remote help worldwide from R690 an hour, with a written quote before any work starts.", path: "/" }),
    scripts: [businessJsonLd(), faqJsonLd([...QUESTIONS])],
  }),
  loader: () => getPaymentMethods(),
  component: PublicSite,
});

function PublicSite() {
  const methods = Route.useLoaderData();
  return (
    <PublicFrame>
      <section className="enter-up pb-4 pt-16 lg:pt-24">
        <p className="text-sm text-accent">VoIP, networking, and IT infrastructure</p>
        <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-[0.96] tracking-[-0.04em] sm:text-7xl">
          Get the phones and the network working again.
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted">
          Tell us what stopped. You receive a written quote before anyone starts, and remote help
          begins at R690 an hour, worldwide. There is no retainer and no account to open.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#enquiry" className="inline-flex h-11 items-center rounded-md bg-accent px-5 text-sm font-medium text-accent-fg">
            Get a written quote
          </a>
          <a href="#prices" className="inline-flex h-11 items-center rounded-md px-5 text-sm shadow-[var(--shadow-border)]">
            See the prices
          </a>
        </div>
        <PathExhibit />
      </section>

      <section className="border-t border-border py-20" aria-labelledby="why-heading">
        <h2 id="why-heading" className="max-w-2xl font-serif text-4xl tracking-[-0.03em] sm:text-5xl">
          Why people ask us first
        </h2>
        <ul className="mt-12 grid gap-10 md:grid-cols-3">
          {[
            ["You see the price first", "The form does not start the job. A written quote does, and only after you agree."],
            ["Help can start remotely", "From R690 an hour, worldwide. On-site work is arranged when the job needs someone there."],
            ["No retainer to join", "There is no monthly package. You pay for the agreed work, then you are done."],
          ].map(([title, body]) => (
            <li key={title}>
              <h3 className="font-serif text-3xl">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="services" className="border-t border-border py-20" aria-labelledby="services-heading">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <h2 id="services-heading" className="font-serif text-4xl tracking-[-0.03em] sm:text-5xl">
            What we fix
          </h2>
          <p className="max-w-xs text-sm text-muted">
            Where should we start?{" "}
            <Link to="/work" className="text-fg underline-offset-4 hover:underline">
              See the kind of work
            </Link>
            .
          </p>
        </div>
        <ul className="mt-12 border-t border-fg/20">
          {SERVICE_LINES.map((line, index) => (
            <li key={line.number} className="border-b border-fg/15">
              <Link
                to="/services/$slug"
                params={{ slug: SERVICE_PAGES[index]?.slug ?? "voip" }}
                className="group grid gap-3 py-8 sm:grid-cols-[4.5rem_1fr_auto] sm:items-baseline sm:gap-8"
              >
                <p className="font-mono text-sm text-accent">{line.number}</p>
                <div>
                  <h3 className="font-serif text-4xl tracking-[-0.03em] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-8">
                    {line.title}
                  </h3>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">{line.summary}</p>
                </div>
                <p className="font-mono text-sm">
                  {line.price} <span aria-hidden className="ml-2 text-accent transition-transform group-hover:translate-x-1">→</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="prices" className="border-t border-border py-20" aria-labelledby="price-heading">
        <div className="grid gap-8 lg:grid-cols-[16rem_1fr] lg:gap-16">
          <div>
            <h2 id="price-heading" className="font-serif text-4xl tracking-[-0.03em] sm:text-5xl">Plain prices</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              In South African rand. VAT is added only if the written quote says so. Travel is priced before an on-site visit is booked.
            </p>
          </div>
          <div>
            <ul className="border-t border-fg/20">
              {publicRateRows().map((rate) => (
                <li key={rate.id} className="grid gap-2 border-b border-fg/15 py-6 sm:grid-cols-[1fr_9rem] sm:gap-8">
                  <div>
                    <h3 className="text-base font-medium">{rate.title}</h3>
                    <p className="mt-1 text-sm text-muted">{rate.scope}</p>
                    <p className="mt-2 text-sm text-subtle">{rate.basis}</p>
                  </div>
                  <p className="font-mono text-sm sm:text-right">{rate.price}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">
              Hosted PBX, SIP trunk, call usage, number porting, equipment, and software licences are not in the labour rate.{" "}
              <Link to="/rates" className="text-fg underline-offset-4 hover:underline">
                The full rate sheet
              </Link>{" "}
              includes assessments, design, and travel. Monthly managed support is not offered. After-hours work is by appointment. It is not an emergency line.
            </p>
          </div>
        </div>
      </section>

        <Enquiry />

        <Faq />

      <section id="payment" className="border-t border-border py-20" aria-labelledby="pay-heading">
        <div className="grid gap-8 lg:grid-cols-[16rem_1fr] lg:gap-16">
          <div>
            <h2 id="pay-heading" className="font-serif text-4xl tracking-[-0.03em]">Payment</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Use the reference on the quote or invoice. Card checkout is not available.
            </p>
          </div>
          <div>
            <ul className="border-t border-fg/20">
              {methods.map((method) => (
                <li key={method.id} className="grid gap-1 border-b border-fg/15 py-5 sm:grid-cols-[9rem_1fr] sm:gap-8">
                  <h3 className="text-sm font-medium">
                    {method.title}
                    <span className="mt-1 block text-xs font-normal text-subtle">{method.available ? "Available" : "Not available"}</span>
                  </h3>
                  <p className="text-sm text-muted">{method.detail}</p>
                </li>
              ))}
            </ul>
            <PaidNotice />
          </div>
        </div>
      </section>
    </PublicFrame>
  );
}

const QUESTIONS = [
  {
    q: "Does the form lock me in?",
    a: "No. Asking for a quote is not a contract. Work starts only after you accept the written quote.",
  },
  {
    q: "Is VAT included?",
    a: "Only if the written quote says so. It is never added quietly.",
  },
  {
    q: "Can I pay by card?",
    a: "No. You can pay by EFT or international wire. Please do not email card numbers.",
  },
  {
    q: "Is this an emergency line?",
    a: "No. After-hours work is by appointment. It is not a promise that someone will attend immediately.",
  },
] as const;

function Faq() {
  return (
    <section aria-labelledby="faq-heading" className="border-t border-border py-20">
      <h2 id="faq-heading" className="font-serif text-4xl tracking-[-0.03em]">
        Before you ask
      </h2>
      <div className="mt-10 grid gap-x-16 gap-y-8 md:grid-cols-2">
        {QUESTIONS.map((item) => (
          <div key={item.q} className="border-t border-fg/15 pt-5">
            <h3 className="text-sm font-medium">{item.q}</h3>
            <p className="mt-2 text-sm text-muted">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PaidNotice() {
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
      <p className="mt-6 max-w-xl text-sm text-muted">
        Recorded. This is not a receipt. The invoice stays unpaid until the money is confirmed in the account.
      </p>
    );
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mt-8 grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <p className="text-sm text-muted">Already paid by EFT or wire? Tell us the reference. Card payments are not accepted here.</p>
      </div>
      <div>
        <Label htmlFor="pay-name">Name</Label>
        <Input id="pay-name" className="mt-2" required minLength={2} maxLength={160} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      </div>
      <div>
        <Label htmlFor="pay-email">Email</Label>
        <Input id="pay-email" type="email" className="mt-2" required maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
      </div>
      <div>
        <Label htmlFor="pay-ref">Quote or invoice reference</Label>
        <Input id="pay-ref" className="mt-2" required placeholder="VA-" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} />
      </div>
      <div>
        <Label htmlFor="pay-amount">Amount paid (ZAR)</Label>
        <Input id="pay-amount" className="mt-2" required inputMode="decimal" placeholder="690.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
      </div>
      <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
      {error ? <p className="text-sm text-danger sm:col-span-2">{error}</p> : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Sending…" : "I've paid"}</Button>
      </div>
    </form>
  );
}

function Enquiry() {
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
      setError("The enquiry could not be recorded. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section id="enquiry" className="grid gap-12 border-t border-border py-20 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
      <div>
        <h2 className="font-serif text-4xl tracking-[-0.03em] sm:text-5xl">Get a written quote.</h2>
        <ol className="mt-10 space-y-6">
          {[
            ["01", "Tell us what stopped", "A few sentences are enough. This is not a contract."],
            ["02", "We price it in writing", "You see the scope, the timing, and the total before anyone starts."],
            ["03", "You decide", "Work begins only after you accept that quote."],
          ].map(([n, title, body]) => (
            <li key={n} className="grid grid-cols-[3rem_1fr] gap-3">
              <span className="font-mono text-sm text-accent">{n}</span>
              <span>
                <span className="block text-base font-medium">{title}</span>
                <span className="mt-1 block text-sm text-muted">{body}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-10 text-sm text-muted">
          Already a customer?{" "}
          <Link to="/support" className="text-fg underline-offset-4 hover:underline">
            Use the service desk
          </Link>
          . Do not include passwords or card numbers.
        </p>
      </div>
      {done ? (
        <div className="rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
          <p className="font-serif text-3xl">Recorded.</p>
          <p className="mt-3 text-sm text-muted">
            Recorded. If mail is connected, a short acknowledgement is on its way. It is not a quote and it does not start paid work. Submitting does not create a contract.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              name="name"
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
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
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
            <Label htmlFor="message">How can we help?</Label>
            <Textarea
              id="message"
              name="message"
              className="mt-2"
              required
              minLength={5}
              maxLength={3000}
              rows={6}
              placeholder="Describe the VoIP, networking, or IT infrastructure issue."
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
            />
          </div>
          <div className="h-0 overflow-hidden" aria-hidden="true">
            Leave this field empty
            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(event) => setForm({ ...form, website: event.target.value })}
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Sending…" : "Request my quote"}
          </Button>
          <p className="text-xs text-subtle">
            Submitting an enquiry does not create a contract or authorize paid work.
          </p>
        </form>
      )}
    </section>
  );
}
