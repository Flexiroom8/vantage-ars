import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PublicFrame } from "@/components/public/site-frame";
import { FormConfirmation } from "@/components/public/form-confirmation";
import { EnquiryForm } from "@/components/public/enquiry-form";
import { SignalAtlas } from "@/components/public/signal-atlas";
import { ServiceArt } from "@/components/public/service-art";
import {
  CloudIcon,
  InfraIcon,
  NetworkIcon,
  QuoteIcon,
  RestoreIcon,
  ShieldIcon,
  SignalBars,
  VoipIcon,
} from "@/components/public/motion-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitPaymentNotice, getPaymentMethods } from "@/lib/office/api";
import type { PaymentMethod } from "@/lib/office/invoice";
import { allMethodsAwaitBankDetails } from "@/lib/office/invoice";
import { SERVICE_PAGES } from "@/lib/site/services";
import { SERVICE_LINES, rateAmount } from "@/lib/office/catalogue";
import { businessJsonLd, faqJsonLd, pageHead, SITE_URL, jsonLd } from "@/lib/site/seo";
import { COMPANY } from "@/lib/office/company";

const LINE_ICONS = [
  VoipIcon,
  NetworkIcon,
  InfraIcon,
  SignalBars,
  CloudIcon,
  ShieldIcon,
  RestoreIcon,
  CloudIcon,
] as const;

/** Every service line, paired with the page that explains it. */
const DEPARTMENTS = SERVICE_LINES.flatMap((line, index) => {
  const page = SERVICE_PAGES.find((item) => item.title === line.title);
  return page ? [{ line, page, Icon: LINE_ICONS[index] ?? VoipIcon }] : [];
});

const VISUAL_SERVICES = SERVICE_PAGES.map((page) => ({
  slug: page.slug,
  title: page.title,
  note: page.lead,
}));

const QUICK_PATHS = [
  {
    number: "01",
    title: "Calls & phones",
    detail: "VoIP, call quality or a handset that has gone quiet.",
    slug: "voip",
    Icon: VoipIcon,
  },
  {
    number: "02",
    title: "Wi-Fi & network",
    detail: "Slow connections, dropouts or a network that needs setting up.",
    slug: "networking",
    Icon: NetworkIcon,
  },
  {
    number: "03",
    title: "Computers & systems",
    detail: "Infrastructure, security, backups or business IT support.",
    slug: "it-infrastructure",
    Icon: InfraIcon,
  },
  {
    number: "04",
    title: "Repetitive admin",
    detail: "Find a sensible, human-controlled place for AI automation.",
    slug: "ai-automation",
    Icon: SignalBars,
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Diagnose remotely first",
    body: "Endpoint and network symptoms, plus the call-path details you can provide.",
  },
  {
    n: "02",
    title: "Written quote",
    body: "Scope, hours, travel and VAT fixed in writing. Nothing starts until you accept.",
  },
  {
    n: "03",
    title: "Configure and test",
    body: "The agreed work is done and tested against the checks we set with you.",
  },
] as const;

// One source of truth for the FAQ: rendered on the page (search engines only
// surface FAQ rich results for content that is visible to users) and emitted
// as FAQPage JSON-LD from Route.head below.
const FAQS = [
  {
    q: "How do I get a quote?",
    a: "Send the enquiry form. You get a written quote with scope and total before anyone starts.",
  },
  {
    q: "Do you charge VAT?",
    a: "VAT is added only when the written quote says so.",
  },
  {
    q: "Do you offer managed support?",
    a: "Yes. There is a monthly managed support plan at a fixed published price, remote only, with a written report every month. There is no live monitoring of your estate, no uptime promise and no contractual service level.",
  },
];

export const Route = createFileRoute("/")({
  head: () => {
    const head = pageHead({
      title: "VoIP, networking & IT infrastructure · Vantage-ARS",
      description:
        "Worldwide remote VoIP, networking and IT infrastructure support from Vantage-ARS, with clear ZAR pricing and a written quote before work starts.",
      path: "/",
      authorName: COMPANY.authorName,
    });

    return {
      ...head,
      scripts: [
        businessJsonLd(),
        faqJsonLd(FAQS),
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

  return (
    <PublicFrame>
      <section className="home-hero border-b border-border py-10 sm:py-14">
        <div className="home-hero-panel grid items-center gap-10 overflow-hidden rounded-[1.75rem] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative">
            <p className="home-hero-kicker font-mono text-xs tracking-[0.22em] uppercase">
              <span className="home-kicker-mark" aria-hidden="true" />
              Support for the tech your business runs on
            </p>

            <h1 className="home-hero-title mt-5 max-w-3xl text-5xl leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              Your tech's got a problem.
              <span className="home-title-highlight">Start here.</span>
            </h1>

            <p className="home-hero-copy mt-6 max-w-xl text-lg leading-relaxed">
              Remote support worldwide, on-site by arrangement. Know the scope, timing and total in
              writing before any work starts.
            </p>

            <div className="home-hero-actions mt-8 flex flex-wrap gap-3">
              <Link
                to="/"
                hash="enquiry"
                className="home-primary-cta cta inline-flex h-12 items-center rounded-md px-5 text-sm font-semibold"
              >
                Tell us what's up <span aria-hidden="true">↗</span>
              </Link>

              <Link
                to="/rates"
                className="cta-ghost inline-flex h-11 items-center rounded-md px-5 text-sm font-semibold"
              >
                See published rates
              </Link>
            </div>
            <p className="home-hero-rates mt-5 text-sm">
              Remote from R{rateAmount("remote-support")}/hr · On-site from R
              {rateAmount("onsite-support")}/hr · VAT only where quoted
            </p>
          </div>

          <figure className="home-hero-figure relative overflow-hidden">
            <img
              src="/images/network-operations.svg"
              alt="Illustrated network operations system connecting voice, network equipment and server infrastructure"
              className="home-hero-image aspect-[4/3] w-full object-cover"
              fetchPriority="high"
            />
            <div className="home-hero-image-shade" aria-hidden="true" />
            <SignalAtlas />
            <div className="home-hero-index font-mono" aria-hidden="true">
              <span>VA / FIELD NOTES</span>
              <span>001—008</span>
            </div>
            <div className="home-hero-stamp" aria-hidden="true">
              <span>ONE</span>
              <span>clear</span>
              <span>desk</span>
            </div>
            <figcaption className="home-hero-caption">
              <span className="home-caption-dot" aria-hidden="true" />
              Every connection has a path. We help trace it.
            </figcaption>
          </figure>
        </div>
        <div className="home-proofline" aria-label="How work is agreed">
          <span>Remote worldwide</span>
          <span>Written scope first</span>
          <span>No work starts until you accept</span>
        </div>
      </section>

      <section className="home-need-finder" aria-labelledby="need-heading">
        <div className="home-section-heading">
          <div>
            <p className="home-section-kicker">A good place to start</p>
            <h2 id="need-heading">What needs a hand?</h2>
          </div>
          <Link to="/find" className="home-finder-link">
            Not sure? Try the 3-question finder <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <div className="home-quick-paths">
          {QUICK_PATHS.map(({ number, title, detail, slug, Icon }) => (
            <Link key={slug} to="/services/$slug" params={{ slug }} className="home-quick-path">
              <span className="home-quick-path-top">
                <span className="home-quick-number">{number}</span>
                <Icon className="home-quick-icon" aria-hidden="true" />
              </span>
              <span className="home-quick-title">{title}</span>
              <span className="home-quick-detail">{detail}</span>
              <span className="home-quick-arrow" aria-hidden="true">
                ↗
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-b border-border py-16" aria-label="The practice">
        <div className="home-section-heading">
          <div>
            <p className="home-section-kicker">A clearer picture of the work</p>
            <h2 className="text-4xl sm:text-5xl">One connected system.</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted">
            From the first call to the systems behind it, see what each service line is built to
            solve.
          </p>
        </div>
        <ul className="practice-visuals mt-8">
          {VISUAL_SERVICES.map((service) => (
            <li key={service.slug}>
              <Link
                to="/services/$slug"
                params={{ slug: service.slug }}
                className="practice-visual-card group"
                aria-label={`${service.title}: ${service.note}`}
              >
                <ServiceArt slug={service.slug} className="practice-visual-art" />
                <span className="practice-visual-copy">
                  <span className="practice-visual-title">{service.title}</span>
                  <span className="practice-visual-arrow" aria-hidden="true">
                    ↗
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted">
          <Link to="/model" className="text-accent underline-offset-4 hover:underline">
            How the office runs
          </Link>
          , including what it does alone and what still waits.
        </p>
      </section>

      <section id="services" className="border-b border-border py-16" aria-label="Departments">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-4xl sm:text-5xl">Eight service lines, one desk</h2>

          <Link
            to="/services"
            className="font-mono text-xs tracking-[0.18em] text-subtle uppercase transition-colors hover:text-accent"
          >
            All service lines →
          </Link>
        </div>

        <div className="mt-8 border-t border-border">
          {DEPARTMENTS.map(({ line, page, Icon }) => (
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

                <span className="mt-2 block max-w-xl text-sm leading-relaxed text-muted">
                  {page.description}
                </span>
              </span>

              <span className="font-mono text-sm text-accent sm:text-right">{line.price}</span>

              <span
                aria-hidden
                className="hidden text-subtle transition-transform group-hover:translate-x-1 group-hover:text-accent sm:block"
              >
                &#8594;
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface/50 p-5">
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            Not sure which line fits? Answer three questions and the service finder will name the
            closest published line, the guides that narrow it and what to put in the enquiry.
          </p>
          <Link
            to="/find"
            className="cta-ghost inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
          >
            Find your starting point
          </Link>
          <Link
            to="/assess"
            className="cta-ghost inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
          >
            Assess IT readiness
          </Link>
          <Link
            to="/automation"
            className="cta-ghost inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
          >
            Assess AI automation fit
          </Link>
        </div>
      </section>

      <section id="autonomy" className="border-t border-border py-12" aria-label="AI-native office">
        <div className="panel flex flex-wrap items-center justify-between gap-6 rounded-2xl p-6 sm:p-8">
          <div className="max-w-2xl">
            <p className="font-mono text-xs tracking-[0.22em] text-accent uppercase">
              AI-native office
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Automation with clear limits.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Specialist agents handle routine records and follow-up. Spending, high-impact
              decisions and customer commitments stay behind explicit controls.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/model"
              className="cta-ghost inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
            >
              How the office works
            </Link>
            <Link
              to="/automation"
              className="cta inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
            >
              Assess an AI workflow
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-border py-16" aria-label="How a job runs">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-4xl sm:text-5xl">How a job runs</h2>

          <p className="font-mono text-xs tracking-[0.18em] text-subtle uppercase">
            Same path every time
          </p>
        </div>

        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.n}
              className={`panel rounded-2xl p-6 ${
                index === 1 ? "enter-up d-1" : index === 2 ? "enter-up d-2" : "enter-up"
              }`}
            >
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

      <section id="prices" className="border-t border-border py-12" aria-label="Published prices">
        <div className="panel flex flex-wrap items-center justify-between gap-6 rounded-2xl p-6 sm:p-8">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">
              Clear pricing
            </p>
            <h2 className="mt-2 text-3xl">
              Remote support from R{rateAmount("remote-support")}/hr.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Managed plans have fixed published prices. VAT is included only when the written quote
              says so.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/rates"
              className="cta inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
            >
              View all rates
            </Link>
            <Link
              to="/services/$slug"
              params={{ slug: "managed-support" }}
              className="cta-ghost inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
            >
              Managed services
            </Link>
          </div>
        </div>
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
              <EnquiryForm
                nameMaxLength={120}
                messagePlaceholder="What stopped working, or what you want set up."
                submitLabel="Request a quote"
              />
            </div>
          </div>

          <div id="payment" className="scroll-mt-24" aria-label="Payment">
            <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">
              02 · Payment notice
            </p>

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

      <section className="border-t border-border py-16" aria-label="Common questions">
        <h2 className="text-4xl sm:text-5xl">Common questions</h2>

        <dl className="mt-8 max-w-3xl divide-y divide-border border-y border-border">
          {FAQS.map((faq) => (
            <div key={faq.q} className="py-6">
              <dt className="font-serif text-2xl">{faq.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">{faq.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </PublicFrame>
  );
}

function PaymentForm({ payment }: { payment: unknown }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    reference: "",
    amount: "",
    website: "",
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const result = await submitPaymentNotice({
        data: form,
      });

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
      <FormConfirmation>
        <p className="text-3xl text-ok">Noted.</p>

        <p className="mt-3 text-sm text-muted">
          Your payment notice is recorded. A receipt follows after it is checked.
        </p>
      </FormConfirmation>
    );
  }

  const methods = Array.isArray(payment) ? (payment as PaymentMethod[]) : [];

  return (
    <form onSubmit={onSubmit} className="glass space-y-4 rounded-2xl p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pay-name">Name on payment</Label>

          <Input
            id="pay-name"
            className="mt-2"
            required
            value={form.name}
            onChange={(event) =>
              setForm({
                ...form,
                name: event.target.value,
              })
            }
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
            onChange={(event) =>
              setForm({
                ...form,
                email: event.target.value,
              })
            }
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
            onChange={(event) =>
              setForm({
                ...form,
                reference: event.target.value,
              })
            }
          />
        </div>

        <div>
          <Label htmlFor="pay-amount">Amount (R)</Label>

          <Input
            id="pay-amount"
            className="mt-2"
            required
            inputMode="decimal"
            pattern="[0-9]+([.,][0-9]+)?"
            title="Enter the amount in rand, for example 690.00"
            placeholder="690.00"
            value={form.amount}
            onChange={(event) =>
              setForm({
                ...form,
                amount: event.target.value,
              })
            }
          />
        </div>
      </div>

      <div className="h-0 overflow-hidden" aria-hidden="true">
        Leave this field empty
        <input
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(event) =>
            setForm({
              ...form,
              website: event.target.value,
            })
          }
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {allMethodsAwaitBankDetails(methods) ? (
        <p className="text-xs text-subtle">Bank details are sent with your quote or invoice.</p>
      ) : null}

      <Button type="submit" disabled={pending} className="cta w-full border-0 sm:w-auto">
        {pending ? "Sending…" : "Notify payment"}
      </Button>
    </form>
  );
}
