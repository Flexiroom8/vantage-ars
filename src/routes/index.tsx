import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PublicFrame } from "@/components/public/site-frame";
import { InfraIcon, LiveNode, NetworkIcon, QuoteIcon, SignalBars, VoipIcon } from "@/components/public/motion-icons";
import { PathExhibit } from "@/components/public/live-field";
import { DecodeText } from "@/components/public/decode-text";
import { CountUp } from "@/components/public/count-up";
import { SignalPath } from "@/components/public/signal-path";
import { Reveal } from "@/components/public/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitPublicEnquiry, submitPaymentNotice, getPaymentMethods } from "@/lib/office/api";
import { SERVICE_PAGES } from "@/lib/site/services";
import { SERVICE_LINES, publicRateRows } from "@/lib/office/catalogue";
import { businessJsonLd, faqJsonLd, pageHead, SITE_URL, jsonLd } from "@/lib/site/seo";

const LINE_ICONS = [VoipIcon, NetworkIcon, InfraIcon] as const;

const STEPS = [
  { n: "01", title: "Diagnose remotely first", body: "Endpoint and network symptoms, plus the call-path details you can provide." },
  { n: "02", title: "Written quote", body: "Scope, hours, travel and VAT fixed in writing. Nothing starts until you accept." },
  { n: "03", title: "Configure and test", body: "The agreed work is done and tested against the checks we set with you." },
] as const;

const STATS = [
  { value: 690, prefix: "R", suffix: " / hr", label: "Remote support, from" },
  { value: 805, prefix: "R", suffix: " / hr", label: "On-site, by arrangement" },
  { value: 3, label: "Departments on this desk" },
  { value: 0, label: "Retainers and SLA promises" },
] as const;

const FEATURES = [
  {
    title: "Remote-first diagnosis",
    body: "We look at the symptoms, path and evidence before we recommend a site visit. That keeps the plan tighter and reduces wasted time.",
  },
  {
    title: "Transparent quotes",
    body: "The price, scope, travel notes, and VAT treatment are written down before work starts. No surprise add-ons after the fact.",
  },
  {
    title: "Tested completion",
    body: "The work is checked against agreed outcomes, with a short completion note so everyone knows exactly what changed.",
  },
] as const;

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
      <section
        className="relative pb-16 pt-16 lg:pt-24"
        onMouseMove={(event) => {
          const el = event.currentTarget;
          const rect = el.getBoundingClientRect();
          el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
          el.style.setProperty("--my", `${event.clientY - rect.top}px`);
        }}
      >
        <div aria-hidden className="spotlight pointer-events-none absolute inset-0 overflow-hidden" />
        <div className="grid items-start gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative">
            <p className="enter-up flex items-center gap-2.5 font-mono text-xs tracking-[0.22em] text-accent uppercase">
              <span className="live-dot size-1.5 rounded-full bg-ok" aria-hidden="true" />
              <DecodeText text="VoIP · Networking · IT infrastructure" />
            </p>
            <h1 className="enter-up d-1 mt-5 max-w-3xl text-5xl leading-[1.02] tracking-[-0.03em] sm:text-7xl">
              Clear scope.{" "}
              <span className="bg-gradient-to-r from-accent to-ok bg-clip-text text-transparent">
                Written quote.
              </span>{" "}
              No surprises.
            </h1>
            <p className="enter-up d-2 mt-6 max-w-2xl text-lg leading-relaxed text-muted">
              Worldwide remote support from R690 an hour, on-site by arrangement from R805 an hour.
              You see the scope, timing and total in writing before anyone starts.
            </p>
            <div className="enter-up d-3 mt-8 flex flex-wrap gap-3">
              <Link
                to="/"
                hash="enquiry"
                className="cta inline-flex h-11 items-center rounded-md px-5 text-sm font-semibold"
              >
                Get a written quote
              </Link>
              <Link
                to="/rates"
                className="cta-ghost inline-flex h-11 items-center rounded-md px-5 text-sm font-semibold"
              >
                See published rates
              </Link>
            </div>
          </div>

          <div className="enter-up d-2 panel rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-fg uppercase">
                <LiveNode className="size-4" aria-hidden="true" />
                Departments
              </p>
              <p className="font-mono text-[11px] tracking-[0.16em] text-ok uppercase">Desk open</p>
            </div>
            <ul className="divide-y divide-border">
              {SERVICE_LINES.map((line, index) => {
                const Icon = LINE_ICONS[index] ?? VoipIcon;
                const page = SERVICE_PAGES[index];
                return (
                  <li key={line.number}>
                    <Link
                      to="/services/$slug"
                      params={{ slug: page.slug }}
                      className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-raised/60"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-raised">
                        <Icon className="size-5 text-accent" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-fg group-hover:text-accent">{line.title}</span>
                        <span className="mt-0.5 block text-sm text-muted">{line.price}</span>
                      </span>
                      <SignalBars className="size-4 shrink-0 text-ok" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-border px-6 py-4">
              <Link to="/services/$slug" params={{ slug: "voip" }} className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-accent uppercase hover:underline">
                Open a department
              <QuoteIcon className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
        <PathExhibit />
      </section>

      <section className="border-y border-border" aria-label="Desk facts">
        <dl className="grid divide-border sm:grid-cols-2 sm:divide-x lg:grid-cols-4">
          {STATS.map((stat, index) => (
            <Reveal key={stat.label} delay={index === 0 ? undefined : (index as 1 | 2 | 3)} className="p-6 sm:p-8">
              <dd className="font-mono text-3xl font-semibold tabular-nums text-fg sm:text-4xl">
                <CountUp value={stat.value} prefix={"prefix" in stat ? stat.prefix : ""} suffix={"suffix" in stat ? stat.suffix : ""} />
              </dd>
              <dt className="mt-2 text-sm text-muted">{stat.label}</dt>
            </Reveal>
          ))}
        </dl>
      </section>

      <section id="services" className="border-b border-border py-16" aria-label="Departments">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-4xl sm:text-5xl">Three departments, one desk</h2>
          <p className="font-mono text-xs tracking-[0.18em] text-subtle uppercase">Pick what stopped</p>
        </div>
        <div className="mt-8 border-t border-border">
          {SERVICE_PAGES.map((page, index) => {
            const Icon = LINE_ICONS[index] ?? VoipIcon;
            return (
              <Link
                key={page.slug}
                to="/services/$slug"
                params={{ slug: page.slug }}
                className="group grid gap-3 border-b border-border px-2 py-6 transition-colors hover:bg-raised/50 sm:grid-cols-[3rem_1fr_10rem_2rem] sm:items-center sm:gap-6 sm:px-4"
              >
                <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-raised">
                  <Icon className="size-6 text-accent" aria-hidden="true" />
                </span>
                <span>
                  <span className="flex items-baseline gap-3">
                    <span className="font-mono text-xs text-subtle">{page.number}</span>
                    <span className="text-2xl group-hover:text-accent sm:text-3xl">{page.title}</span>
                  </span>
                  <span className="mt-2 block max-w-xl text-sm leading-relaxed text-muted">{page.description}</span>
                </span>
                <span className="font-mono text-sm text-accent sm:text-right">{SERVICE_LINES[index]?.price ?? "From R690 / hour"}</span>
                <span aria-hidden className="hidden text-subtle transition-transform group-hover:translate-x-1 group-hover:text-accent sm:block">
                  &#8594;
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <SignalPath />

      <section className="border-t border-border py-16" aria-label="How a job runs">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-4xl sm:text-5xl">How a job runs</h2>
          <p className="font-mono text-xs tracking-[0.18em] text-subtle uppercase">Same path every time</p>
        </div>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.n} className={`panel rounded-2xl p-6 ${index === 1 ? "enter-up d-1" : index === 2 ? "enter-up d-2" : "enter-up"}`}>
              <div className="flex items-center justify-between">
                <p className="font-mono text-sm text-accent">{step.n}</p>
                <QuoteIcon className="size-5 text-subtle" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-2xl">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="prices" className="border-t border-border py-16" aria-label="Prices">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-4xl sm:text-5xl">Published rates</h2>
          <p className="font-mono text-xs tracking-[0.18em] text-subtle uppercase">South African rand</p>
        </div>
        <p className="mt-3 max-w-xl text-base text-muted">
          VAT is added only when the written quote says so.{" "}
          <Link to="/rates" className="text-accent underline-offset-4 hover:underline">
            Full rate sheet
          </Link>
          .
        </p>
        <ul className="mt-8 border-t border-border">
          {rates.slice(0, 6).map((rate) => (
            <li
              key={rate.id}
              className="grid gap-2 border-b border-border py-5 transition-colors hover:bg-raised/40 sm:grid-cols-[1fr_10rem] sm:gap-8"
            >
              <div>
                <h3 className="text-base font-semibold text-fg">{rate.title}</h3>
                <p className="mt-1 text-sm text-muted">{rate.scope}</p>
              </div>
              <p className="font-mono text-sm font-medium text-accent sm:text-right">{rate.price}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-border py-16" aria-label="Forms">
        <div className="grid gap-8 lg:grid-cols-2">
          <div id="enquiry" className="scroll-mt-24" aria-label="Enquiry">
            <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">01 · Enquiry</p>
            <h2 className="mt-4 text-4xl sm:text-5xl">Ask for a quote</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
              A few sentences are enough. This is not a contract — you get a written quote first.
            </p>
            <div className="mt-8">
              <EnquiryForm />
            </div>
          </div>
          <div id="payment" className="scroll-mt-24" aria-label="Payment">
            <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">02 · Payment notice</p>
            <h2 className="mt-4 text-4xl sm:text-5xl">Paid already? Tell us.</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
              Send the reference from your quote or invoice. This records your notice — it is not an
              automatic receipt.
            </p>
            <div className="mt-8">
              <PaymentForm payment={payment} />
            </div>
          </div>
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
      <div className="panel rounded-2xl p-6">
        <p className="text-3xl text-ok">Received.</p>
        <p className="mt-3 text-sm text-muted">
          Your enquiry is recorded. You will get a written quote before any work is agreed.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="glass space-y-4 rounded-2xl p-5">
      <div>
        <Label htmlFor="enquiry-name">Your name</Label>
        <Input
434|           id="enquiry-email"
435|           type="email"
436|           className="mt-2"
437|           autoComplete="email"
438|           required
439|           maxLength={254}
440|           value={form.email}
441|           onChange={(event) => setForm({ ...form, email: event.target.value })}
442|         />
443|       </div>
444|       <div>
445|         <Label htmlFor="enquiry-message">What do you need?</Label>
446|         <Textarea
447|           id="enquiry-message"
448|           className="mt-2"
449|           required
450|           minLength={5}
451|           maxLength={3000}
452|           rows={5}
453|           placeholder="What stopped working, or what you want set up."
454|           value={form.message}
455|           onChange={(event) => setForm({ ...form, message: event.target.value })}
456|         />
457|       </div>
458|       <div className="h-0 overflow-hidden" aria-hidden="true">
459|         Leave this field empty
460|         <input
461|           tabIndex={-1}
462|           autoComplete="off"
463|           value={form.website}
464|           onChange={(event) => setForm({ ...form, website: event.target.value })}
465|         />
466|       </div>
467|       {error ? (
468|         <p role="alert" className="text-sm text-danger">
469|           {error}
470|         </p>
471|       ) : null}
472|       <Button type="submit" disabled={pending} className="cta w-full border-0 sm:w-auto">
473|         {pending ? "Sending…" : "Request a quote"}
474|       </Button>
475|     </form>
476|   );
477| }
478| 
479| function PaymentForm({ payment }: { payment: unknown }) {
480|   const [pending, setPending] = useState(false);
481|   const [done, setDone] = useState(false);
482|   const [error, setError] = useState<string | null>(null);
483|   const [form, setForm] = useState({ name: "", email: "", reference: "", amount: "", website: "" });
484| 
485|   async function onSubmit(event: FormEvent) {
486|     event.preventDefault();
487|     setPending(true);
488|     setError(null);
489|     try {
490|       const result = await submitPaymentNotice({ data: form });
491|       if (!result.ok) {
492|         setError(result.error);
493|         return;
494|       }
495|       setDone(true);
496|     } catch {
497|       setError("The notice could not be recorded. Try again in a moment.");
498|     } finally {
499|       setPending(false);
500|     }
501|   }
502| 
503|   if (done) {
504|     return (
505|       <div className="panel rounded-2xl p-6">
506|         <p className="text-3xl text-ok">Noted.</p>
507|         <p className="mt-3 text-sm text-muted">
508|           Your payment notice is recorded. A receipt follows after it is checked.
509|         </p>
510|       </div>
511|     );
512|   }
513| 
514|   const methods = Array.isArray(payment) ? (payment as { detail: string }[]) : [];
515| 
516|   return (
517|     <form onSubmit={onSubmit} className="glass space-y-4 rounded-2xl p-5">
518|       <div className="grid gap-4 sm:grid-cols-2">
519|         <div>
520|           <Label htmlFor="pay-name">Name on payment</Label>
521|           <Input
522|             id="pay-name"
523|             className="mt-2"
524|             required
525|             value={form.name}
526|             onChange={(event) => setForm({ ...form, name: event.target.value })}
527|           />
528|         </div>
529|         <div>
530|           <Label htmlFor="pay-email">Email</Label>
531|           <Input
532|             id="pay-email"
533|             type="email"
534|             className="mt-2"
535|             required
536|             value={form.email}
537|             onChange={(event) => setForm({ ...form, email: event.target.value })}
538|           />
539|         </div>
540|       </div>
541|       <div className="grid gap-4 sm:grid-cols-2">
542|         <div>
543|           <Label htmlFor="pay-ref">Reference (VA-…)</Label>
544|           <Input
545|             id="pay-ref"
546|             className="mt-2"
547|             required
548|             placeholder="VA-XXXX"
549|             value={form.reference}
550|             onChange={(event) => setForm({ ...form, reference: event.target.value })}
551|           />
552|         </div>
553|         <div>
554|           <Label htmlFor="pay-amount">Amount (R)</Label>
555|           <Input
556|             id="pay-amount"
557|             className="mt-2"
558|             required
559|             inputMode="decimal"
560|             pattern="[0-9]+([.,][0-9]+)?"
561|             title="Enter the amount in rand, for example 690.00"
562|             placeholder="690.00"
563|             value={form.amount}
564|             onChange={(event) => setForm({ ...form, amount: event.target.value })}
565|           />
566|         </div>
567|       </div>
568|       <div className="h-0 overflow-hidden" aria-hidden="true">
569|         Leave this field empty
570|         <input
571|           tabIndex={-1}
572|           autoComplete="off"
573|           value={form.website}
574|           onChange={(event) => setForm({ ...form, website: event.target.value })}
575|         />
576|       </div>
577|       {error ? <p className="text-sm text-danger">{error}</p> : null}
578|       {methods.length > 0 && methods.every((m) => m.detail.includes("sent with")) ? (
579|         <p className="text-xs text-subtle">
580|           Bank details are sent with your quote or invoice.
581|         </p>
582|       ) : null}
583|       <Button type="submit" disabled={pending} className="cta w-full border-0 sm:w-auto">
584|         {pending ? "Sending…" : "Notify payment"}
585|       </Button>
586|     </form>
587|   );
588| }
589| 
