/** RFC 2047 encoded-word for subjects that contain non-ASCII characters (names, rand signs, accents). */
export function encodeSubject(subject: string): string {
  if (/^[\x20-\x7e]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

export function smtpData(input: { from: string; to: string; subject: string; body: string }): string {
  const subject = input.subject.replace(/[\r\n]+/g, " ").trim().slice(0, 180);
  const from = input.from.replace(/[\r\n]+/g, "").trim();
  const to = input.to.replace(/[\r\n]+/g, "").trim();
  const text = input.body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const stuffed = text
    .split("\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
  return [
    `From: Vantage-ARS <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    stuffed,
    "",
  ].join("\r\n");
}
