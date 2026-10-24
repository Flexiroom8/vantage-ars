export const DIAGNOSTIC_DRAFT_KEY = "vantage-email-auth-diagnostic";

export type EmailAuthCheck = {
  domain: string;
  spf: { state: "found" | "missing" | "multiple"; records: string[] };
  dmarc: { state: "found" | "missing" | "multiple"; records: string[] };
  dkim: { selector: string; state: "found" | "missing"; records: string[] };
};

type TxtLookup = (name: string) => Promise<string[]>;

function normalizeDomain(value: string): string {
  const domain = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .split(/[/?#]/)[0]
    .split(":")[0]
    .replace(/\.$/, "");

  if (
    domain.length > 253 ||
    !domain.includes(".") ||
    !domain.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  ) {
    throw new Error("Enter a valid domain name.");
  }
  return domain;
}

function recordState(records: string[]): EmailAuthCheck["spf"]["state"] {
  return records.length === 0 ? "missing" : records.length === 1 ? "found" : "multiple";
}

function normalizeTxtRecord(record: string): string {
  return record.trim().replace(/^"+|"+$/g, "").trim().slice(0, 600);
}

function boundedRecords(records: string[]): string[] {
  return [...new Set(records.map(normalizeTxtRecord).filter(Boolean))]
    .slice(0, 5)
    .map((record) => record.slice(0, 600));
}

async function lookupTxt(name: string): Promise<string[]> {
  const url = new URL("https://dns.google/resolve");
  url.searchParams.set("name", name);
  url.searchParams.set("type", "TXT");
  const response = await fetch(url, { headers: { accept: "application/dns-json" } });
  if (!response.ok) throw new Error(`DNS lookup failed (HTTP ${response.status}).`);
  const payload = (await response.json()) as {
    Answer?: { type?: number; data?: string }[];
  };
  return (payload.Answer ?? [])
    .filter((answer) => answer.type === 16 && typeof answer.data === "string")
    .map((answer) => answer.data!.replaceAll('"', ""))
    .map(normalizeTxtRecord)
    .slice(0, 5)
    .map((record) => record.slice(0, 600));
}

export async function checkEmailAuth(
  domainInput: string,
  selectorInput: string,
  lookup: TxtLookup = lookupTxt,
): Promise<EmailAuthCheck> {
  const domain = normalizeDomain(domainInput);
  const selector = selectorInput.trim().toLowerCase();
  if (!/^[a-zA-Z0-9_-]{1,63}$/.test(selector)) {
    throw new Error("Enter the DKIM selector used by your mail provider.");
  }

  const [spfRecords, dmarcRecords, dkimRecords] = await Promise.all([
    lookup(domain).then((records) =>
      boundedRecords(
        records
          .map(normalizeTxtRecord)
          .filter((record) => /^v=spf1(?:\s|$)/i.test(record.trim())),
      ),
    ),
    lookup(`_dmarc.${domain}`).then((records) =>
      boundedRecords(
        records
          .map(normalizeTxtRecord)
          .filter((record) => /^v=dmarc1(?:\s|;|$)/i.test(record.trim())),
      ),
    ),
    lookup(`${selector}._domainkey.${domain}`).then((records) =>
      boundedRecords(
        records
          .map(normalizeTxtRecord)
          .filter((record) => /^(?:v=dkim1(?:\s|;|$)|p=)/i.test(record.trim())),
      ),
    ),
  ]);

  return {
    domain,
    spf: { state: recordState(spfRecords), records: spfRecords },
    dmarc: { state: recordState(dmarcRecords), records: dmarcRecords },
    dkim: {
      selector,
      state: dkimRecords.length > 0 ? "found" : "missing",
      records: dkimRecords,
    },
  };
}

export function emailAuthSummary(result: EmailAuthCheck): string {
  const line = (label: string, records: string[]) =>
    `${label}: ${
      records.length
        ? records
            .map((record) => record.slice(0, 600))
            .join(" | ")
            .slice(0, 700)
        : "No matching TXT record found"
    }`;
  return [
    `Email authentication DNS check for ${result.domain}`,
    line("SPF", result.spf.records),
    line("DMARC", result.dmarc.records),
    line(`DKIM (${result.dkim.selector})`, result.dkim.records),
    "Checked public DNS records only; this does not verify message alignment or delivery.",
  ].join("\n");
}
