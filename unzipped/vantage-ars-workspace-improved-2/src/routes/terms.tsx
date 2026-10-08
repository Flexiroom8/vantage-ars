import { createFileRoute } from "@tanstack/react-router";
import { PublicFrame } from "@/components/public/site-frame";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "How work is agreed · Vantage-ARS" },
      {
        name: "description",
        content:
          "A Vantage-ARS enquiry or chat is not a contract. Work starts from a written quote. Card payment is not available.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <PublicFrame>
      <article className="enter-up max-w-2xl py-16">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Before any work</p>
        <h1 className="mt-4 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">How work is agreed</h1>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted">
          <p>
            An enquiry, a live chat, or a service-desk message is not a contract and not a quote.
            Work starts only from a written quote that states the scope, timing, and total price.
          </p>
          <p>
            Published labour is R690 per hour remote and R805 per hour on-site. VAT is not added
            unless that written quote says so. Travel, hosted PBX, SIP trunk, call usage, number
            porting, equipment, software licences, and other third-party charges are extra and are
            itemised before they are agreed.
          </p>
          <p>
            Monthly managed support is not offered. After-hours work is by appointment. It is not an
            emergency response guarantee.
          </p>
          <p>
            Pay by EFT or international wire, using the reference on the quote or invoice. Card
            checkout is not available. Do not email card numbers.
          </p>
        </div>
      </article>
    </PublicFrame>
  );
}
