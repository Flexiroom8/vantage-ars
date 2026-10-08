import { createFileRoute } from "@tanstack/react-router";
import { PublicFrame } from "@/components/public/site-frame";
import { COMPANY } from "@/lib/office/company";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy · Vantage-ARS" },
      {
        name: "description",
        content: "What Vantage-ARS collects when you enquire, use live chat, or tell us you have paid.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicFrame>
      <article className="enter-up max-w-2xl py-16">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">POPIA</p>
        <h1 className="mt-4 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">Privacy</h1>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted">
          <p>
            Vantage-ARS collects only what you send us: your name, email address, and the message,
            chat, or payment notice you submit. A payment notice also includes the reference and the
            amount you say you paid.
          </p>
          <p>
            We use that to answer the enquiry, keep a service matter, or check a claimed payment. We
            do not sell it. Do not send passwords, card numbers, or other secrets.
          </p>
          <p>
            A short acknowledgement may be emailed when mail is connected. It is not a quote. Live
            chat is stored so the office can reply in the same thread.
          </p>
          <p>
            To ask for a copy of what we hold, or to correct it, write to{" "}
            <a className="text-fg underline-offset-4 hover:underline" href={`mailto:${COMPANY.email}`}>
              {COMPANY.email}
            </a>
            .
          </p>
        </div>
      </article>
    </PublicFrame>
  );
}
