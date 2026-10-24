/**
 * Customer email.
 *
 * The office may email a customer, but only under a founder delegation, and
 * only from a template written here. The agent never supplies the wording: it
 * names a template and the office renders it from real records. That is what
 * makes autonomous email safe — there is no path from an agent's prose to a
 * customer's inbox.
 *
 * The rendered body is checked once more before it is allowed out, for the
 * words that turn a statement into a promise. A template that trips the check
 * is not sent; the founder can still send it by hand.
 *
 * Pure module. No database, no clock, no environment.
 */
import { formatZar } from "./money";

export const CUSTOMER_MAIL_TEMPLATES = [
  "service_report",
  "invoice",
  "receipt",
  "payment_reminder",
  "quote",
  "subscription_started",
  "diagnostic_checklist",
] as const;

export type CustomerMailTemplate = (typeof CUSTOMER_MAIL_TEMPLATES)[number];

export type CustomerMailContext = {
  companyName: string;
  amountCents?: number;
  reference?: string | null;
  report?: string | null;
  periodLabel?: string | null;
  paymentNote?: string | null;
  quoteBody?: string | null;
  quoteUrl?: string | null;
  planTitle?: string | null;
  daysOverdue?: number;
  diagnosticChecklist?: { label: string; checks: string[] } | null;
};

export type CustomerMail =
  { ok: true; subject: string; body: string } | { ok: false; error: string };

/**
 * The one clause the office is allowed to say: it denies a promise.
 *
 * "This is not a guarantee of future performance" is the truthfulness
 * statement every report carries. Without this carve-out the office would
 * have to either lie by omission or never send a report at all.
 */
const DENIAL_CLAUSE = "is not a guarantee of future performance";

/**
 * Words that would turn a statement of fact into a promise. The office does
 * not sell uptime, availability, or a service level, so it must not say them.
 */
const PROMISE_PATTERNS: RegExp[] = [
  /\bguarantee[ds]?\b/i,
  /\bguaranteed\b/i,
  /\b24\/7\b/i,
  /\bwithin \d+\s*(hour|day|minute)/i,
  /\bfixed price\b/i,
  /\bdiscount\b/i,
  /\bfree\b/i,
  /\bno charge\b/i,
  /\bwe will (restore|resolve|fix)/i,
  /\buptime\b/i,
  /\bsla\b/i,
  /\bcheapest\b/i,
  /\bbest price\b/i,
];

/** Whether a body says something the office must not say. */
export function containsPromise(text: string): boolean {
  return PROMISE_PATTERNS.some((pattern) => pattern.test(text));
}

/** Remove the single denying clause, so it cannot trip the promise check. */
function stripDenialClause(text: string): string {
  return text.split(DENIAL_CLAUSE).join("");
}

function safeName(value: string): string {
  const name = value.replace(/\s+/g, " ").trim();
  return name.length ? name.slice(0, 160) : "there";
}

function greeting(name: string): string {
  return `Hello ${safeName(name)},`;
}

function moneyBlock(cents: number): string {
  return `Amount: ${formatZar(cents)}`;
}

function paymentBlock(note: string | null | undefined): string {
  const text = (note ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "Bank details are sent with your invoice. Please quote the reference when you pay.";
  }
  return `How to pay: ${text.slice(0, 400)}`;
}

function serviceReportMail(ctx: CustomerMailContext): CustomerMail {
  if (!ctx.report?.trim()) return { ok: false, error: "There is no report to send." };
  return {
    ok: true,
    subject: `Your ${ctx.planTitle ?? "service report"} — ${ctx.periodLabel ?? "this period"}`,
    body: [
      greeting(ctx.companyName),
      "",
      `Your ${ctx.planTitle ?? "service report"} for ${ctx.periodLabel ?? "this period"} is below.`,
      "",
      ctx.report.trim(),
      "",
      "—",
      "Vantage-ARS",
    ].join("\n"),
  };
}

function invoiceMail(ctx: CustomerMailContext): CustomerMail {
  const cents = Math.max(0, Math.round(ctx.amountCents ?? 0));
  if (cents <= 0) return { ok: false, error: "There is no invoice figure to send." };
  return {
    ok: true,
    subject: `Your invoice from Vantage-ARS${ctx.reference ? ` — ${ctx.reference}` : ""}`,
    body: [
      greeting(ctx.companyName),
      "",
      "Your invoice is below. Nothing further is needed from you until the payment date.",
      "",
      moneyBlock(cents),
      ctx.reference ? `Reference: ${ctx.reference}` : "",
      "",
      paymentBlock(ctx.paymentNote),
      "",
      "VAT is added only where the invoice states it.",
      "",
      "—",
      "Vantage-ARS",
    ]
      .filter((line) => line !== "")
      .join("\n"),
  };
}

function receiptMail(ctx: CustomerMailContext): CustomerMail {
  const cents = Math.max(0, Math.round(ctx.amountCents ?? 0));
  if (cents <= 0) return { ok: false, error: "There is no receipt figure to send." };
  return {
    ok: true,
    subject: `Your receipt from Vantage-ARS${ctx.reference ? ` — ${ctx.reference}` : ""}`,
    body: [
      greeting(ctx.companyName),
      "",
      "We have your payment. This receipt matches the invoice.",
      "",
      moneyBlock(cents),
      ctx.reference ? `Reference: ${ctx.reference}` : "",
      "",
      "—",
      "Vantage-ARS",
    ]
      .filter((line) => line !== "")
      .join("\n"),
  };
}

function paymentReminderMail(ctx: CustomerMailContext): CustomerMail {
  const cents = Math.max(0, Math.round(ctx.amountCents ?? 0));
  if (cents <= 0) return { ok: false, error: "There is no invoice figure to chase." };
  const days = Math.max(0, Math.round(ctx.daysOverdue ?? 0));
  return {
    ok: true,
    subject: `A reminder about your invoice from Vantage-ARS${ctx.reference ? ` — ${ctx.reference}` : ""}`,
    body: [
      greeting(ctx.companyName),
      "",
      days > 0
        ? `Our invoice has been open for ${days} day(s). This is a reminder, not a demand, and not a statement that anything is wrong.`
        : "This is a friendly reminder about an open invoice.",
      "",
      moneyBlock(cents),
      ctx.reference ? `Reference: ${ctx.reference}` : "",
      "",
      paymentBlock(ctx.paymentNote),
      "",
      "If the payment is already on its way, ignore this and it will clear on our side.",
      "",
      "—",
      "Vantage-ARS",
    ]
      .filter((line) => line !== "")
      .join("\n"),
  };
}

function quoteMail(ctx: CustomerMailContext): CustomerMail {
  if (!ctx.quoteBody?.trim()) return { ok: false, error: "There is no quote to send." };
  return {
    ok: true,
    subject: "Your quote from Vantage-ARS",
    body: [
      greeting(ctx.companyName),
      "",
      "Your quote is below.",
      "",
      ctx.quoteBody.trim(),
      "",
      ctx.quoteUrl
        ? `Accept or decline the quote here: ${ctx.quoteUrl}`
        : "Reply to this email if you would like anything changed.",
      "",
      "—",
      "Vantage-ARS",
    ].join("\n"),
  };
}

function subscriptionStartedMail(ctx: CustomerMailContext): CustomerMail {
  const cents = Math.max(0, Math.round(ctx.amountCents ?? 0));
  return {
    ok: true,
    subject: `Your ${ctx.planTitle ?? "managed service"} is running`,
    body: [
      greeting(ctx.companyName),
      "",
      `Your ${ctx.planTitle ?? "managed service"} is now running. We will send you a report each period, and an invoice for the period.`,
      ctx.periodLabel ? `First period: ${ctx.periodLabel}.` : "",
      cents > 0 ? moneyBlock(cents) : "",
      ctx.reference ? `Reference: ${ctx.reference}` : "",
      "",
      "—",
      "Vantage-ARS",
    ]
      .filter((line) => line !== "")
      .join("\n"),
  };
}

function diagnosticChecklistMail(ctx: CustomerMailContext): CustomerMail {
  const checklist = ctx.diagnosticChecklist;
  if (!checklist || checklist.checks.length === 0) {
    return { ok: false, error: "There is no approved diagnostic checklist for this quote." };
  }
  return {
    ok: true,
    subject: `A few safe checks before the agreed work — ${checklist.label}`,
    body: [
      greeting(ctx.companyName),
      "",
      "We recorded your acceptance of the diagnostic quote. These simple, customer-led observations may help locate the fault before the agreed work begins:",
      "",
      checklist.label,
      ...checklist.checks.map((check, index) => `${index + 1}. ${check}`),
      "",
      "Do not share passwords, sign-in codes, access tokens, or confidential customer data. Do not run scans, disconnect or restart equipment, or change settings as part of this checklist.",
      "",
      "This checklist stays within the accepted diagnostic scope and does not add a separate charge. Any repair or work outside that accepted scope needs a new written quote and your approval. The diagnostic work may narrow the cause; whether it can be corrected depends on the findings.",
      "",
      "Reply to this email with the observations when convenient. If you would rather not do these checks, say so and the agreed work can be handled without them.",
      "",
      "—",
      "Vantage-ARS",
    ].join("\n"),
  };
}

const RENDERERS: Record<CustomerMailTemplate, (ctx: CustomerMailContext) => CustomerMail> = {
  service_report: serviceReportMail,
  invoice: invoiceMail,
  receipt: receiptMail,
  payment_reminder: paymentReminderMail,
  quote: quoteMail,
  subscription_started: subscriptionStartedMail,
  diagnostic_checklist: diagnosticChecklistMail,
};

export function isCustomerMailTemplate(value: unknown): value is CustomerMailTemplate {
  return (
    typeof value === "string" && (CUSTOMER_MAIL_TEMPLATES as readonly string[]).includes(value)
  );
}

/**
 * Render a customer email from a template and real values.
 *
 * The result is refused if it says something the office must not say. A
 * refused email is a customer who has not been emailed, which the founder
 * would rather have than a promise the office cannot keep.
 */
export function renderCustomerMail(
  template: CustomerMailTemplate,
  ctx: CustomerMailContext,
): CustomerMail {
  const renderer = RENDERERS[template];
  if (!renderer) return { ok: false, error: "Unknown customer email template." };
  const mail = renderer(ctx);
  if (!mail.ok) return mail;
  if (containsPromise(stripDenialClause(mail.body))) {
    return {
      ok: false,
      error:
        "The email said something the office must not promise, so it was not sent. The founder can send it by hand.",
    };
  }
  return mail;
}
