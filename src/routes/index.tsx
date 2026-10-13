import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/site/seo";
import { PublicFrame } from "@/components/public/site-frame";
import { COMPANY } from "@/lib/office/company";

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageHead({
      title: "Privacy · Vantage-ARS",
      description: "What Vantage-ARS collects when you enquire, use live chat, or tell us you have paid.",
      path: "/privacy",
    }),
  component: PrivacyPage,
});

const TOPICS = [
  {
    title: "What we collect",
    body: "We collect only what you send us: your name, email address, the enquiry or chat message, and any payment notice you submit. A payment notice may include the reference and amount you say you paid.",
  },
  {
    title: "Why we collect it",
    body: "We use it to answer your enquiry, keep a service matter, or check a claimed payment. We do not sell it. We do not keep card numbers or passwords that you send by accident.",
  },
  {
    title: "How it is used",
    body: "A short acknowledgement may be emailed when mail is connected. Live chat is stored so the office can continue the same thread. The office may also use the information to prepare a quote or service update.",
  },
  {
    title: "Your rights",
    body: "To ask for a copy of what we hold, or to correct it, write to the email below. We will do our best to respond clearly and promptly.",
  },
] as const;

function PrivacyPage() {
  return (
    <PublicFrame>
      <article className="enter-up max-w-3xl py-16">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">POPIA</p>
        <h1 className="mt-4 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">Privacy</h1>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {TOPICS.map((item) => (
            <section key={item.title} className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-border)]">
              <h2 className="font-serif text-2xl">{item.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-2xl bg-[#0e1c33] p-8 text-white">
          <h2 className="font-serif text-3xl tracking-[-0.03em]">Contact</h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/75">
            To ask for a copy of what we hold, or to correct it, write to{" "}
            <a className="text-white underline-offset-4 hover:underline" href={`mailto:${COMPANY.email}`}>
              {COMPANY.email}
            </a>
            .
          </p>
        </div>
      </article>
    </PublicFrame>
  );
}
