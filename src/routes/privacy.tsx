import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/site/seo";
import { PublicFrame } from "@/components/public/site-frame";
import { COMPANY } from "@/lib/office/company";

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageHead({
      title: "Privacy · Vantage-ARS",
      description:
        "How Vantage-ARS handles enquiries, service-desk messages and quotes. Contact details are used to respond, never sold.",
      path: "/privacy",
    }),
  component: PrivacyPage,
});

const POINTS = [
  {
    title: "What we collect",
    body: "Your name, email address and the message you send via the enquiry form, service desk, chat or quote link. No account is created for visitors.",
  },
  {
    title: "Why we keep it",
    body: "To respond, prepare a written quote, and keep a record of what was agreed. Founder review only — no marketing list, no sale of data.",
  },
  {
    title: "How long",
    body: "Enquiries and service matters are kept as business records. Ask for deletion and the founder reviews it against record-keeping duties.",
  },
  {
    title: "Cookies and tracking",
    body: "No advertising cookies. The site does not run third-party trackers. Fonts load from Google Fonts; chat and forms post directly to this site.",
  },
  {
    title: "Your rights",
    body: `Access, correction or deletion: email ${COMPANY.email}. South African POPIA rights apply alongside any other applicable rights.`,
  },
] as const;

function PrivacyPage() {
  return (
    <PublicFrame>
      <article className="enter-up max-w-3xl py-16">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Privacy</p>
        <h1 className="mt-4 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">
          Your details stay with the job.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
          An enquiry or chat is not a contract. When you contact Vantage-ARS, the details you
          provide are used to respond and, if you ask for one, to prepare a written quote.
        </p>
        <div className="mt-10 space-y-4">
          {POINTS.map((point) => (
            <section
              key={point.title}
              className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-border)]"
            >
              <h2 className="font-serif text-2xl">{point.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{point.body}</p>
            </section>
          ))}
        </div>
      </article>
    </PublicFrame>
  );
}
