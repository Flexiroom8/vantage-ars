import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import type { FounderNotice } from "./notice";
import { sendFounderMail } from "./smtp.server";

export async function deliverFounderNotice(notice: FounderNotice): Promise<void> {
  let status = "not_delivered";
  let detail = "Gmail SMTP is not connected. The customer was not emailed.";
  try {
    const result = await sendFounderMail(notice.subject, notice.body);
    if (result.ok) {
      status = "sent";
      detail = "Sent through Gmail SMTP. The customer was not copied.";
    } else if (result.error) {
      detail = result.error;
    }
  } catch {
    detail = "Gmail SMTP could not be reached. The customer was not emailed.";
  }

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
