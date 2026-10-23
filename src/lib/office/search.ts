import type { OfficeSnapshot } from "./types";

export type OfficeSearchKind =
  | "page"
  | "customer"
  | "approval"
  | "ticket"
  | "document"
  | "money"
  | "plan"
  | "lead"
  | "opportunity"
  | "inbound"
  | "decision"
  | "notice"
  | "audit";

export type OfficeSearchHit = {
  id: string;
  kind: OfficeSearchKind;
  title: string;
  detail: string;
  href: string;
  score: number;
};

type Entry = Omit<OfficeSearchHit, "score">;

const PAGES: Entry[] = [
  {
    id: "page-command",
    kind: "page",
    title: "Command center",
    detail: "Office health, approvals and the current queue",
    href: "/office",
  },
  {
    id: "page-approvals",
    kind: "page",
    title: "Approvals",
    detail: "Founder gate, waiting and resolved decisions",
    href: "/office/approvals",
  },
  {
    id: "page-floor",
    kind: "page",
    title: "Floor",
    detail: "Agent status and autonomous activity",
    href: "/office/floor",
  },
  {
    id: "page-inbox",
    kind: "page",
    title: "Inbox",
    detail: "Inbound enquiries, payment notices and routing",
    href: "/office/inbox",
  },
  {
    id: "page-customers",
    kind: "page",
    title: "Customers",
    detail: "Customer book, plans and contact records",
    href: "/office/customers",
  },
  {
    id: "page-chat",
    kind: "page",
    title: "Chat",
    detail: "Founder and staff working conversation",
    href: "/office/chat",
  },
  {
    id: "page-service",
    kind: "page",
    title: "Service",
    detail: "Tickets, service reports and fulfilment",
    href: "/office/service",
  },
  {
    id: "page-catalogue",
    kind: "page",
    title: "Catalogue",
    detail: "Plans, rates and published offers",
    href: "/office/catalogue",
  },
  {
    id: "page-marketing",
    kind: "page",
    title: "Marketing",
    detail: "Campaigns, site signals and public interest",
    href: "/office/marketing",
  },
  {
    id: "page-sales",
    kind: "page",
    title: "Sales",
    detail: "Leads, opportunities and handoffs",
    href: "/office/sales",
  },
  {
    id: "page-ledger",
    kind: "page",
    title: "Ledger",
    detail: "Journal, receivables and payables",
    href: "/office/ledger",
  },
  {
    id: "page-technical",
    kind: "page",
    title: "Technical",
    detail: "Technical record and system notes",
    href: "/office/technical",
  },
  {
    id: "page-revenue",
    kind: "page",
    title: "Revenue",
    detail: "Recurring revenue, ageing and renewals",
    href: "/office/revenue",
  },
  {
    id: "page-governance",
    kind: "page",
    title: "Governance record",
    detail: "Decision episodes, gate records and signed receipts",
    href: "/office/governance",
  },
  {
    id: "page-delegation",
    kind: "page",
    title: "Delegation",
    detail: "Standing authority and its usage",
    href: "/office/delegations",
  },
  {
    id: "page-constitution",
    kind: "page",
    title: "Constitution",
    detail: "Articles, provisions and enforcement",
    href: "/office/constitution",
  },
  {
    id: "page-audit",
    kind: "page",
    title: "Audit",
    detail: "Hash-chained office record",
    href: "/office/audit",
  },
  {
    id: "page-metrics",
    kind: "page",
    title: "Metrics",
    detail: "Autonomy, quality and intervention metrics",
    href: "/office/metrics",
  },
];

function normal(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9@._/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreEntry(entry: Entry, terms: string[]): number {
  const title = normal(entry.title);
  const haystack = normal(`${entry.title} ${entry.detail} ${entry.kind} ${entry.href}`);
  if (!terms.every((term) => haystack.includes(term))) return 0;
  let score = 10;
  if (title === terms.join(" ")) score = 120;
  else if (title.startsWith(terms[0])) score = 80;
  else if (terms.every((term) => title.includes(term))) score = 55;
  else if (terms.some((term) => title.includes(term))) score = 30;
  if (entry.kind === "page") score += 8;
  return score;
}

function uniqueCustomers(snapshot: OfficeSnapshot): Entry[] {
  const seen = new Map<string, Entry>();
  const add = (name: string, detail: string) => {
    const key = normal(name);
    if (!key || seen.has(key)) return;
    seen.set(key, {
      id: `customer-${key}`,
      kind: "customer",
      title: name,
      detail,
      href: "/office/customers",
    });
  };
  for (const subscription of snapshot.subscriptions) {
    add(subscription.companyName, `plan · ${subscription.status} · ${subscription.planId}`);
  }
  for (const inbound of snapshot.inbound) {
    add(inbound.companyName, `inbound · ${inbound.status} · ${inbound.intent}`);
  }
  for (const lead of snapshot.leads) add(lead.companyName, `lead · ${lead.stage}`);
  for (const opportunity of snapshot.opportunities) {
    add(opportunity.companyName, `opportunity · ${opportunity.stage}`);
  }
  for (const invoice of snapshot.ledger) {
    if (invoice.kind === "invoice" || invoice.kind === "payment") {
      add(invoice.counterparty, `ledger · ${invoice.kind} · ${invoice.status}`);
    }
  }
  return [...seen.values()];
}

function buildEntries(snapshot: OfficeSnapshot): Entry[] {
  return [
    ...PAGES,
    ...uniqueCustomers(snapshot),
    ...snapshot.approvals.map((row) => ({
      id: `approval-${row.id}`,
      kind: "approval" as const,
      title: row.title,
      detail: `${row.companyName ?? row.kind} · ${row.status}${row.resolutionNote ? ` · ${row.resolutionNote}` : ""}`,
      href: "/office/approvals",
    })),
    ...snapshot.tickets.map((row) => ({
      id: `ticket-${row.id}`,
      kind: "ticket" as const,
      title: row.title,
      detail: `${row.severity} · ${row.status} · ${row.summary}`,
      href: "/office/service",
    })),
    ...snapshot.documents.map((row) => ({
      id: `document-${row.id}`,
      kind: "document" as const,
      title: row.title,
      detail: `${row.kind} · ${row.status} · ${row.summary}`,
      href: "/office/customers",
    })),
    ...snapshot.ledger.map((row) => ({
      id: `ledger-${row.id}`,
      kind: "money" as const,
      title: `${row.kind} · ${row.counterparty}`,
      detail: `${row.status} · ${row.memo}`,
      href: "/office/ledger",
    })),
    ...snapshot.subscriptions.map((row) => ({
      id: `plan-${row.id}`,
      kind: "plan" as const,
      title: `${row.companyName} · ${row.planId}`,
      detail: `${row.status} · ${row.cycle} · next ${String(row.nextBillingAt ?? "").slice(0, 10)}`,
      href: "/office/revenue",
    })),
    ...snapshot.leads.map((row) => ({
      id: `lead-${row.id}`,
      kind: "lead" as const,
      title: row.companyName,
      detail: `${row.stage} · score ${row.score} · ${row.summary}`,
      href: "/office/sales",
    })),
    ...snapshot.opportunities.map((row) => ({
      id: `opportunity-${row.id}`,
      kind: "opportunity" as const,
      title: row.companyName,
      detail: `${row.stage} · ${row.summary}`,
      href: "/office/sales",
    })),
    ...snapshot.inbound.map((row) => ({
      id: `inbound-${row.id}`,
      kind: "inbound" as const,
      title: row.subject,
      detail: `${row.companyName} · ${row.intent} · ${row.status}`,
      href: "/office/inbox",
    })),
    ...snapshot.decisions.map((row) => ({
      id: `decision-${row.id}`,
      kind: "decision" as const,
      title: row.title,
      detail: `${row.actionKind} · ${row.status} · ${row.rationale}`,
      href: "/office/audit",
    })),
    ...snapshot.notices.map((row) => ({
      id: `notice-${row.id}`,
      kind: "notice" as const,
      title: row.subject,
      detail: `${row.kind} · ${row.status} · ${row.detail}`,
      href: "/office/inbox",
    })),
    ...snapshot.audit.map((row) => ({
      id: `audit-${row.id}`,
      kind: "audit" as const,
      title: row.title,
      detail: `${row.kind} · ${row.actor} · ${row.body}`,
      href: "/office/audit",
    })),
  ];
}

export function searchOffice(
  snapshot: OfficeSnapshot,
  query: string,
  limit = 16,
): OfficeSearchHit[] {
  const terms = normal(query).split(" ").filter(Boolean);
  if (terms.length === 0) return [];
  return buildEntries(snapshot)
    .map((entry) => ({ ...entry, score: scoreEntry(entry, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, Math.max(1, Math.min(limit, 40)));
}
