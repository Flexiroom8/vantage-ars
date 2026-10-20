import { readFileSync } from "node:fs";
import { join } from "node:path";
import { connect as connectTls, type TLSSocket } from "node:tls";
import { FOUNDER_EMAIL } from "./notice";
import { smtpData } from "./smtp-message";

const HOST = "smtp.gmail.com";
const PORT = 465;

type SmtpConfig = { user: string; password: string };

function cleanPassword(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, "");
}

export function loadSmtpConfig(): SmtpConfig | null {
  const envUser = process.env.GMAIL_SMTP_USER?.trim() ?? "";
  const envPass = cleanPassword(process.env.GMAIL_SMTP_APP_PASSWORD);
  if (envUser.includes("@") && envPass.length >= 8) return { user: envUser, password: envPass };
  try {
    const raw = readFileSync(join(process.cwd(), ".grok", "gmail-smtp.json"), "utf8");
    const parsed = JSON.parse(raw) as { user?: unknown; appPassword?: unknown };
    const user = typeof parsed.user === "string" ? parsed.user.trim() : "";
    const password =
      typeof parsed.appPassword === "string" ? cleanPassword(parsed.appPassword) : "";
    if (user.includes("@") && password.length >= 8) return { user, password };
  } catch {
    return null;
  }
  return null;
}

/** Where the mail credentials come from. "env" is the safe place; the JSON file is a legacy fallback. */
export function smtpCredentialSource(): "env" | "file" | "none" {
  const envUser = process.env.GMAIL_SMTP_USER?.trim() ?? "";
  const envPass = cleanPassword(process.env.GMAIL_SMTP_APP_PASSWORD);
  if (envUser.includes("@") && envPass.length >= 8) return "env";
  return loadSmtpConfig() ? "file" : "none";
}

export function smtpStatus(): { smtpConnected: boolean; account: string | null } {
  const config = loadSmtpConfig();
  return { smtpConnected: Boolean(config), account: config?.user ?? null };
}

function publicError(error: unknown, password: string): string {
  const raw = error instanceof Error ? error.message : "Gmail SMTP could not be reached.";
  const text = raw.replace(password, "").replace(/\s+/g, " ").trim();
  if (/535|534|534-5\.7|535-5\.7|badcredentials|username and password not accepted/i.test(text)) {
    return "Gmail rejected the app password. The customer was not emailed.";
  }
  if (text.startsWith("4") || text.startsWith("5")) {
    return "Gmail refused the message. The customer was not emailed.";
  }
  return (text || "Gmail SMTP could not be reached.").slice(0, 180);
}

export async function sendFounderMail(
  subject: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  return sendMail(FOUNDER_EMAIL, subject, body);
}

export async function sendCustomerMail(
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, error: "The customer email is not usable. Nothing was sent." };
  }
  return sendMail(to, subject, body);
}

async function sendMail(
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const config = loadSmtpConfig();
  if (!config)
    return { ok: false, error: "Gmail SMTP is not connected. The customer was not emailed." };
  const payload = smtpData({ from: config.user, to, subject, body });
  try {
    await smtpSend(config, to, payload);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: publicError(error, config.password) };
  }
}

function smtpSend(config: SmtpConfig, to: string, payload: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.end();
      if (error) reject(error);
      else resolve();
    };
    const socket: TLSSocket = connectTls({ host: HOST, port: PORT, servername: HOST });
    const queued: string[] = [];
    const waiting: Array<(line: string) => void> = [];
    let buffer = "";

    const take = () =>
      new Promise<string>((resolveLine) => {
        const next = queued.shift();
        if (next) resolveLine(next);
        else waiting.push(resolveLine);
      });

    socket.setTimeout(15000, () => finish(new Error("Gmail SMTP timed out.")));
    socket.on("error", (error) => finish(error));
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let split = buffer.indexOf("\r\n");
      while (split !== -1) {
        const line = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        if (/^\d{3} /.test(line)) {
          const waiter = waiting.shift();
          if (waiter) waiter(line);
          else queued.push(line);
        }
        split = buffer.indexOf("\r\n");
      }
    });

    const expect = async (code: string) => {
      const line = await take();
      if (!line.startsWith(code)) throw new Error(line);
    };

    const write = (command: string) => {
      socket.write(`${command}\r\n`);
    };

    void (async () => {
      try {
        await expect("220");
        write("EHLO vantage-ars.co.za");
        await expect("250");
        write("AUTH LOGIN");
        await expect("334");
        write(Buffer.from(config.user).toString("base64"));
        await expect("334");
        write(Buffer.from(config.password).toString("base64"));
        await expect("235");
        write(`MAIL FROM:<${config.user}>`);
        await expect("250");
        write(`RCPT TO:<${to}>`);
        await expect("250");
        write("DATA");
        await expect("354");
        socket.write(`${payload}.\r\n`);
        await expect("250");
        write("QUIT");
        finish();
      } catch (error) {
        finish(error instanceof Error ? error : new Error("Gmail SMTP failed."));
      }
    })();
  });
}
