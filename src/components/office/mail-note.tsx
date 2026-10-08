import type { MailStatus, NoticeRow } from "@/lib/office/types";

export function MailNote({ notices, mail }: { notices: NoticeRow[]; mail: MailStatus }) {
  const latest = notices[0];
  const connection = mail.smtpConnected
    ? `Gmail SMTP is connected as ${mail.account}. Customers are not copied.`
    : "Gmail SMTP is not connected. Notices stay on this desk until an app password is set. Customers are not emailed.";
  return (
    <p className="mb-6 max-w-3xl text-sm text-muted">
      {connection}
      {latest ? ` ${latest.detail}` : ""}
    </p>
  );
}
