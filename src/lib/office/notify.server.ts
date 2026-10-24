import { randomUUID } from "node:crypto";
import { getSql } from "../db";
import { env } from "../env";
import type { FounderNotice } from "./notice";
import { sendFounderMail } from "./smtp.server";
import { postFounderWebhook } from "./webhook";

export async function deliverFounderNotice(notice: FounderNotice): Promise<void> {
  let mailOk = false;
  let mailDetail = "SMTP is not configured. No mail was sent.";
  try {
    const result = await sendFounderMail(notice.subject, notice.body);
    if (result.ok) {
      mailOk = true;
      mailDetail = "Sent through SMTP.";
    } else if (result.error) {
      mailDetail = result.error;
    }
  } catch {
    mailDetail = "SMTP could not be reached. No mail was sent.";
  }

  const webhook = env("FOUNDER_WEBHOOK_URL")
    ? await postFounderWebhook(notice)
    : { ok: false, detail: "" };
  const status = mailOk || webhook.ok ? "sent" : "not_delivered";
  const detail = [mailDetail, webhook.detail].filter(Boolean).join(" ");

  try {
    const sql = await getSql();
    await sql`
      insert into founder_notices (id, kind, subject, status, detail)
      values (${randomUUID()}, ${notice.kind}, ${notice.subject}, ${status}, ${detail})
    `;
  } catch {
    // The office action already stands. A missing notice row must not undo it.
  }
}
