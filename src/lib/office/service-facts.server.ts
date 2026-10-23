/**
 * The facts behind a service report.
 *
 * Every number in a customer-facing report comes from here, and every number
 * here is read from a row the office holds. Remote hours are read from logged
 * time entries when the founder has recorded any for the account and period;
 * otherwise they are estimated from the faults resolved, and the report says
 * so. A customer whose records we do not have gets a report that says so
 * rather than a report that invents a history.
 */
import type { Sql } from "../db";
import type { PlanDefinition } from "./plans";
import {
  emptyFacts,
  ESTIMATED_HOURS_PER_FAULT,
  INTERNAL_TARGET_MINUTES,
  type FaultKind,
  type RateFinding,
  type ServiceFacts,
} from "./fulfilment";

const KIND_RULES: { label: string; test: RegExp }[] = [
  {
    label: "VoIP and phone",
    test: /\b(voip|pbx|sip|dial tone|handset|extension|trunk|call|phone|asterisk|3cx)\b/i,
  },
  {
    label: "Network and Wi-Fi",
    test: /\b(wi-?fi|wifi|switch|router|vlan|lan|network|cable|poe|access point|ap)\b/i,
  },
  {
    label: "Servers and storage",
    test: /\b(server|backup|disk|storage|nas|san|mail|database|sql|vm|virtual)\b/i,
  },
  {
    label: "Connectivity",
    test: /\b(internet|fiber|fibre|broadband|isp|link|uplink|downtime|outage)\b/i,
  },
  {
    label: "Security and access",
    test: /\b(security|firewall|vpn|phish|malware|virus|access|permission|password)\b/i,
  },
];

function classify(text: string): string {
  for (const rule of KIND_RULES) if (rule.test.test(text)) return rule.label;
  return "Other";
}

/** The seats a customer's tickets are found through. */
function customerTickets(sql: Sql, key: string) {
  return sql<{
    id: string;
    title: string;
    severity: string;
    status: string;
    summary: string;
    created_at: string;
    updated_at: string;
  }>`
    select t.id, t.title, t.severity, t.status, t.summary, t.created_at, t.updated_at
    from tickets t
    where t.related_id in (select id from opportunities where lower(company_name) = ${key})
       or t.related_id in (select id from inbound_items where lower(company_name) = ${key})
    order by t.created_at desc
    limit 5000
  `;
}

/**
 * The remote hours the plan includes.
 *
 * The number is read from the plan's own published list, so the report can
 * never quote an allowance the plan has changed.
 */
function includedHours(plan?: PlanDefinition): number {
  if (!plan) return 0;
  const match = plan.includes.join(" ").match(/(\d+)\s*hours?\s*of\s*included/i);
  return match ? Number(match[1]) || 0 : 0;
}

/**
 * Collect the record for one customer over one period.
 *
 * `periodStart` and `periodEnd` are the billing period the contract says, not
 * a window the office chose.
 */
export async function collectServiceFacts(
  sql: Sql,
  input: { companyName: string; periodStart: string; periodEnd: string; plan?: PlanDefinition },
): Promise<ServiceFacts> {
  const company = input.companyName.trim();
  const key = company.toLowerCase();
  const facts = emptyFacts(company, `${input.periodStart} to ${input.periodEnd}`);
  facts.periodStart = input.periodStart;
  facts.periodEnd = input.periodEnd;
  const periodStart = Date.parse(input.periodStart);
  const periodEnd = Date.parse(input.periodEnd);

  const tickets = await customerTickets(sql, key);

  const kinds = new Map<string, number>();
  const historyKinds = new Map<string, number>();
  for (const ticket of tickets) {
    const label = classify(`${ticket.title} ${ticket.summary}`);
    historyKinds.set(label, (historyKinds.get(label) ?? 0) + 1);
    const severity = String(ticket.severity ?? "p3").toLowerCase();
    const opened = Date.parse(String(ticket.created_at));
    const updated = Date.parse(String(ticket.updated_at));
    const resolved = String(ticket.status) === "resolved";
    const raisedInPeriod = Number.isFinite(opened) && opened >= periodStart && opened < periodEnd;
    const resolvedInPeriod =
      resolved && Number.isFinite(updated) && updated >= periodStart && updated < periodEnd;

    if (raisedInPeriod) {
      kinds.set(label, (kinds.get(label) ?? 0) + 1);
      facts.ticketsOpened += 1;
      if (severity === "p1") facts.severityCounts.p1 += 1;
      else if (severity === "p2") facts.severityCounts.p2 += 1;
      else facts.severityCounts.p3 += 1;
    }
    if (resolvedInPeriod) facts.ticketsResolved += 1;
    // One clock is kept for a fault: the time from the fault being raised to
    // the moment its resolution was recorded. There is no response clock, so
    // there is no response figure.
    if (raisedInPeriod && resolved && Number.isFinite(updated)) {
      facts.measuredFaults += 1;
      const target = INTERNAL_TARGET_MINUTES[severity] ?? INTERNAL_TARGET_MINUTES.p3;
      if (updated - opened <= target * 60_000) facts.withinTarget += 1;
    }
    if (!resolved) facts.ticketsOpen += 1;
  }
  facts.faultsOnRecord = tickets.length;
  facts.faultsResolvedOnRecord = tickets.filter(
    (ticket) => String(ticket.status) === "resolved",
  ).length;

  const faultKinds: FaultKind[] = [...kinds.entries()].map(([label, count]) => ({ label, count }));
  facts.faultKinds = faultKinds.sort((a, b) => b.count - a.count);
  const recorded: FaultKind[] = [...historyKinds.entries()].map(([label, count]) => ({
    label,
    count,
  }));
  facts.historyKinds = recorded.sort((a, b) => b.count - a.count);

  // The oldest open faults first: age is what the watch is for. The list is
  // capped; the count above is the whole of what is open.
  const open = tickets
    .filter((ticket) => String(ticket.status) !== "resolved")
    .sort((a, b) => Date.parse(String(a.created_at)) - Date.parse(String(b.created_at)))
    .slice(0, 500);
  for (const ticket of open) {
    const opened = Date.parse(String(ticket.created_at));
    const days = Number.isFinite(opened)
      ? Math.max(0, Math.floor((periodEnd - opened) / 86_400_000))
      : 0;
    facts.openItems.push(
      `${ticket.title} (${String(ticket.severity).toUpperCase()}, still open, ${days} days old at the end of the period)`,
    );
  }

  const invoices = await sql<{
    id: string;
    amount_cents: number;
    created_at: string;
    related_id: string;
  }>`
    select id, amount_cents, created_at, related_id
    from ledger_entries
    where kind = 'invoice' and lower(counterparty) = ${key}
      and created_at >= ${input.periodStart} and created_at < ${input.periodEnd}
    order by created_at asc
    limit 200
  `;
  facts.invoicesIssued = invoices.length;
  facts.invoicedCents = invoices.reduce((sum, row) => sum + Number(row.amount_cents ?? 0), 0);
  facts.spendCents = facts.invoicedCents;

  const quotes = await sql<{ n: number }>`
    select count(*)::int as n
    from documents d
    where d.kind = 'quote'
      and d.related_id in (select id from opportunities where lower(company_name) = ${key})
      and d.created_at >= ${input.periodStart} and d.created_at < ${input.periodEnd}
  `;
  facts.quotesIssued = Number(quotes[0]?.n ?? 0);

  facts.rateFindings = await rateFindings(sql, invoices, key);
  facts.includedHours = includedHours(input.plan);
  // Recorded support time wins. Only when the founder has not logged any time
  // for this account and period does the report fall back to the fault-count
  // estimate, and it labels that figure as an estimate.
  const time = await sql<{ minutes: number; n: number }>`
    select coalesce(sum(minutes), 0)::int as minutes, count(*)::int as n
    from service_time_entries
    where lower(company_name) = ${key}
      and worked_at >= ${input.periodStart} and worked_at < ${input.periodEnd}
  `.then((rows) => rows[0]);
  const recordedMinutes = Number(time?.minutes ?? 0);
  const entries = Number(time?.n ?? 0);
  if (entries > 0) {
    facts.hoursUsed = Math.round((recordedMinutes / 60) * 100) / 100;
    facts.hoursBasis = "recorded";
    facts.timeEntries = entries;
  } else {
    facts.hoursUsed = facts.ticketsResolved * ESTIMATED_HOURS_PER_FAULT;
    facts.hoursBasis = "estimated";
    facts.timeEntries = 0;
  }
  return facts;
}

/**
 * Check every invoice in the period against the published rate card.
 *
 * An invoice matches when its amount is a whole number of a published rate
 * figure — the shape every quote the office issues has. An invoice that does
 * not match is reported, never adjusted.
 */
async function rateFindings(
  sql: Sql,
  invoices: { id: string; amount_cents: number; related_id: string }[],
  companyKey: string,
): Promise<RateFinding[]> {
  if (!invoices.length) return [];
  const { PUBLISHED_RATES } = await import("./catalogue");
  const figures = PUBLISHED_RATES.filter((rate) => rate.offered)
    .map((rate) => {
      const match = rate.price.replace(/,/g, "").match(/R\s*([\d.]+)/);
      return { rate, cents: match ? Math.round(Number(match[1]) * 100) || 0 : 0 };
    })
    .filter((entry) => entry.cents > 0);

  const findings: RateFinding[] = [];
  for (const invoice of invoices) {
    const amount = Number(invoice.amount_cents ?? 0);
    const match = figures.find((entry) => amount > 0 && amount % entry.cents === 0);
    const doc = await sql<{ summary: string }>`
      select summary from documents
      where kind = 'invoice' and related_id = ${invoice.related_id}
      limit 1
    `.then((rows) => rows[0]);
    const reference =
      /Reference:\s*(VA-[A-Z0-9]+)/.exec(doc?.summary ?? "")?.[1] ?? invoice.id.slice(0, 12);
    findings.push({
      reference,
      amountCents: amount,
      matched: Boolean(match),
      detail: match
        ? `${match.rate.title} at ${match.rate.price}`
        : "Does not reconcile to a published rate line",
    });
  }
  void companyKey;
  return findings;
}
