/**
 * Customer notices — the office's own record of what it emailed a customer.
 *
 * A notice is assembled here, from records, and only here. The agent chooses
 * the template; it never chooses the words. The body is stored with the
 * notice, so the office can always answer "what did you actually send?".
 *
 * The recipient is resolved from the records too. The office will not email an
 * address that is not already on file for that customer, which is the
 * difference between a notice and a mailshot.
 */
import type { Sql } from "../db";
import { publicBaseUrl } from "./company";
import { customerQuoteText, documentRef } from "./invoice";
import { renderCustomerMail, type CustomerMailTemplate } from "./customer-mail";
import { cycleShortLabel } from "./subscription";
import { planById } from "./plans";
import { sendCustomerMail } from "./smtp.server";

const EMAIL_IN_TEXT = /Email:\s*([^\s,;]+@[^\s,;]+)/i;

/** The email address the office already holds for this customer, if any. */
export async function resolveRecipient(
  sql: Sql,
  companyName: string,
): Promise<{ email: string | null; name: string | null }> {
  const key = companyName.trim().toLowerCase();
  if (!key) return { email: null, name: null };

  const subscription = await sql<{ contact_email: string; contact_name: string }>`
    select contact_email, contact_name from subscriptions
    where lower(company_name) = ${key} and contact_email is not null
    order by created_at desc limit 1
  `.then((rows) => rows[0]);
  if (subscription?.contact_email) {
    return {
      email: String(subscription.contact_email),
      name: subscription.contact_name ? String(subscription.contact_name) : null,
    };
  }

  const inbound = await sql<{ company_name: string; summary: string }>`
    select company_name, summary from inbound_items
    where lower(company_name) = ${key}
    order by created_at desc limit 1
  `.then((rows) => rows[0]);
  if (inbound?.summary) {
    const found = EMAIL_IN_TEXT.exec(String(inbound.summary));
    if (found) {
      return { email: found[1], name: String(inbound.company_name) };
    }
  }

  const lead = await sql<{ company_name: string; summary: string }>`
    select company_name, summary from leads
    where lower(company_name) = ${key}
    order by updated_at desc limit 1
  `.then((rows) => rows[0]);
  if (lead?.summary) {
    const found = EMAIL_IN_TEXT.exec(String(lead.summary));
    if (found) return { email: found[1], name: String(lead.company_name) };
  }

  return { email: null, name: null };
}

export type NoticeRequest = {
  template: CustomerMailTemplate;
  companyName: string;
  cycleId?: string | null;
  quoteDocumentId?: string | null;
  subscriptionId?: string | null;
  /** An issued invoice, for a reminder. */
  invoiceId?: string | null;
  /** A cleared receipt, for the acknowledgement. */
  receiptId?: string | null;
  /** A freshly created quote link token, when the template is a quote. */
  quoteToken?: string | null;
};

export type NoticeDraft =
  | {
      ok: true;
      recipient: string;
      subject: string;
      body: string;
    }
  | { ok: false; error: string };

/**
 * Build a customer notice from the records it refers to.
 *
 * The caller resolves the recipient, because the quote template needs a link
 * created inside the caller's transaction.
 */
export async function draftNotice(sql: Sql, request: NoticeRequest): Promise<NoticeDraft> {
  const { email, name } = await resolveRecipient(sql, request.companyName);
  if (!email) {
    return {
      ok: false,
      error: `There is no email address on file for ${request.companyName}, so the office did not email anyone.`,
    };
  }

  const payment = await sql<{ payment_instructions: string }>`
    select payment_instructions from company_state limit 1
  `.then((rows) => rows[0]);
  const paymentNote = payment?.payment_instructions ? String(payment.payment_instructions) : null;

  if (request.template === "quote") {
    const quote = await sql<{ id: string; title: string; summary: string }>`
      select id, title, summary from documents
      where id = ${request.quoteDocumentId ?? ""} and kind = 'quote'
    `.then((rows) => rows[0]);
    if (!quote) return { ok: false, error: "That quote is not on file." };
    const body = customerQuoteText(String(quote.summary));
    const url = request.quoteToken ? `${publicBaseUrl()}/q/${request.quoteToken}` : null;
    const mail = renderCustomerMail("quote", {
      companyName: name ?? request.companyName,
      quoteBody: body,
      quoteUrl: url,
    });
    if (!mail.ok) return mail;
    return { ok: true, recipient: email, subject: mail.subject, body: mail.body };
  }

  const cycle = request.cycleId
    ? await sql<{
        id: string;
        company_name: string;
        plan_id: string;
        amount_cents: number;
        period_start: string;
        period_end: string;
        document_id: string | null;
        report_document_id: string | null;
      }>`
        select id, company_name, plan_id, amount_cents, period_start, period_end,
               document_id, report_document_id
        from billing_cycles where id = ${request.cycleId}
      `.then((rows) => rows[0])
    : null;

  let amountCents = 0;
  let reference: string | null = null;
  let report: string | null = null;
  let periodLabel: string | null = null;
  let planTitle: string | null = null;

  if (request.invoiceId) {
    const invoice = await sql<{
      id: string;
      amount_cents: number;
      counterparty: string;
      created_at: string;
      related_id: string;
    }>`
      select id, amount_cents, counterparty, created_at, related_id
      from ledger_entries
      where id = ${request.invoiceId} and kind = 'invoice'
    `.then((rows) => rows[0]);
    if (!invoice) return { ok: false, error: "That invoice is not on file." };
    amountCents = Number(invoice.amount_cents ?? 0);
    const doc = await sql<{ summary: string }>`
      select summary from documents where kind = 'invoice' and related_id = ${invoice.related_id}
      limit 1
    `.then((rows) => rows[0]);
    reference =
      referenceOf(doc?.summary ?? "") ?? `VA-${String(invoice.id).slice(0, 10).toUpperCase()}`;
    periodLabel = periodLabel ?? null;
  }

  if (request.receiptId) {
    const receipt = await sql<{
      id: string;
      amount_cents: number;
      counterparty: string;
      related_id: string;
    }>`
      select id, amount_cents, counterparty, related_id
      from ledger_entries
      where id = ${request.receiptId} and kind = 'receipt'
    `.then((rows) => rows[0]);
    if (!receipt) return { ok: false, error: "That receipt is not on file." };
    amountCents = Number(receipt.amount_cents ?? 0);
    const invoice = await sql<{ related_id: string }>`
      select related_id from ledger_entries
      where id = ${receipt.related_id} and kind = 'invoice'
    `.then((rows) => rows[0]);
    const doc = invoice
      ? await sql<{ summary: string }>`
          select summary from documents
          where kind = 'invoice' and related_id = ${invoice.related_id}
          limit 1
        `.then((rows) => rows[0])
      : undefined;
    reference =
      referenceOf(doc?.summary ?? "") ?? `VA-${String(receipt.id).slice(0, 10).toUpperCase()}`;
  }

  if (cycle) {
    amountCents = Number(cycle.amount_cents ?? 0);
    periodLabel = cycleShortLabel(
      new Date(cycle.period_start).toISOString(),
      new Date(cycle.period_end).toISOString(),
    );
    if (cycle.document_id) {
      const invoice = await sql<{ summary: string }>`
        select summary from documents where id = ${cycle.document_id}
      `.then((rows) => rows[0]);
      const text = invoice?.summary ? String(invoice.summary) : "";
      reference = /Reference:\s*(VA-[A-Z0-9]+)/.exec(text)?.[1] ?? null;
    }
    if (cycle.report_document_id) {
      const doc = await sql<{ summary: string }>`
        select summary from documents where id = ${cycle.report_document_id}
      `.then((rows) => rows[0]);
      report = doc?.summary ? String(doc.summary) : null;
    }
    // The plan title comes from the published plan, not from a column the
    // subscriptions table does not have.
    planTitle = planById(cycle.plan_id)?.title ?? null;
  }

  const mail = renderCustomerMail(request.template, {
    companyName: name ?? request.companyName,
    amountCents,
    reference,
    report,
    periodLabel,
    planTitle,
    paymentNote,
    daysOverdue: 0,
  });
  if (!mail.ok) return mail;
  return { ok: true, recipient: email, subject: mail.subject, body: mail.body };
}
/**
 * Send a prepared notice and record what happened.
 *
 * The send happens outside the audit-chain transaction, because a slow SMTP
 * call must never hold the chain lock open. A notice that could not be sent
 * stays on file as `not_delivered` with the reason — the office never claims
 * to have emailed a customer it did not email.
 */
export async function deliverNotice(
  sql: Sql,
  noticeId: string,
): Promise<{ ok: boolean; detail?: string }> {
  const notice = await sql<{ recipient: string; subject: string; body: string; status: string }>`
    select recipient, subject, body, status from customer_notices where id = ${noticeId}
  `.then((rows) => rows[0]);
  if (!notice) return { ok: false, detail: "The notice is not on file." };
  if (notice.status === "sent") return { ok: true, detail: "It was already sent." };
  if (!String(notice.body).trim()) {
    return { ok: false, detail: "There is no body to send." };
  }
  const result = await sendCustomerMail(
    String(notice.recipient),
    String(notice.subject),
    String(notice.body),
  );
  if (result.ok) {
    await sql`
      update customer_notices
      set status = 'sent', sent_at = now(), detail = 'Delivered.'
      where id = ${noticeId}
    `;
    return { ok: true, detail: "Delivered." };
  }
  const detail = result.error ?? "The message was not delivered.";
  await sql`
    update customer_notices
    set status = 'not_delivered', detail = ${detail}
    where id = ${noticeId}
  `;
  return { ok: false, detail };
}

/** The public reference for a document, if it has one. */
export function referenceOf(summary: string): string | null {
  return /Reference:\s*(VA-[A-Z0-9]+)/.exec(summary)?.[1] ?? null;
}

/** Build a fresh reference for a document id. */
export function newReference(documentId: string): string {
  return documentRef(documentId);
}
