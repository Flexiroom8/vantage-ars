import { csvCell } from "./csv";
import { planById } from "./plans";

export type CustomerActivitySource = "inbound" | "lead" | "opportunity";

export type CustomerActivity = {
  companyName: string;
  source: CustomerActivitySource;
  stage: string;
  score: number;
  valueCents: number;
  createdAt: string;
  updatedAt: string;
};

export type CustomerLedgerRow = {
  companyName: string;
  kind: string;
  amountCents: number;
  status: string;
  createdAt: string;
};

export type CustomerPlanRow = {
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  planId: string;
  cycle: string;
  priceCents: number;
  status: string;
  nextBillingAt: string;
  createdAt: string;
};

export type CustomerStatus = "client" | "prospect" | "lost";

export type CustomerAccount = {
  companyName: string;
  status: CustomerStatus;
  contactName: string | null;
  contactEmail: string | null;
  leadScore: number;
  openOpportunities: number;
  pipelineCents: number;
  wonCents: number;
  invoicedCents: number;
  receivedCents: number;
  outstandingCents: number;
  overdueCents: number;
  activeSubscriptions: number;
  monthlyRecurringCents: number;
  planIds: string[];
  nextBillingAt: string | null;
  firstSeenAt: string | null;
  lastActivityAt: string | null;
  churnRisk: boolean;
};

export type CustomerBookSummary = {
  accounts: number;
  clients: number;
  prospects: number;
  lost: number;
  activeSubscriptions: number;
  monthlyRecurringCents: number;
  invoicedCents: number;
  receivedCents: number;
  outstandingCents: number;
  overdueCents: number;
  churnRisk: number;
};

export type CustomerBook = {
  accounts: CustomerAccount[];
  summary: CustomerBookSummary;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function keyOf(value: string): string {
  return clean(value).toLowerCase();
}

function timeOf(value: string | null | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function monthlyValue(priceCents: number, cycle: string): number {
  const months = cycle === "monthly" ? 1 : cycle === "quarterly" ? 3 : 0;
  return months === 0 ? 0 : Math.round(priceCents / months);
}

type WorkingAccount = CustomerAccount & { displayTime: number; hasLost: boolean };

function emptyAccount(companyName: string, displayTime: number): WorkingAccount {
  return {
    companyName,
    status: "prospect",
    contactName: null,
    contactEmail: null,
    leadScore: 0,
    openOpportunities: 0,
    pipelineCents: 0,
    wonCents: 0,
    invoicedCents: 0,
    receivedCents: 0,
    outstandingCents: 0,
    overdueCents: 0,
    activeSubscriptions: 0,
    monthlyRecurringCents: 0,
    planIds: [],
    nextBillingAt: null,
    firstSeenAt: null,
    lastActivityAt: null,
    churnRisk: false,
    displayTime,
    hasLost: false,
  };
}

function touch(account: WorkingAccount, value: string | null | undefined): void {
  const time = timeOf(value);
  if (time === 0) return;
  if (!account.firstSeenAt || time < timeOf(account.firstSeenAt)) {
    account.firstSeenAt = value ?? null;
  }
  if (!account.lastActivityAt || time > timeOf(account.lastActivityAt)) {
    account.lastActivityAt = value ?? null;
  }
  if (time > account.displayTime) account.displayTime = time;
}

function displayNameFor(
  account: WorkingAccount,
  value: string,
  at: string | null | undefined,
): void {
  const name = clean(value);
  if (!name) return;
  const time = timeOf(at);
  if (!account.companyName || time > account.displayTime) {
    account.companyName = name;
    account.displayTime = time;
  }
}

export function buildCustomerBook(input: {
  activity: CustomerActivity[];
  ledger: CustomerLedgerRow[];
  plans: CustomerPlanRow[];
  nowIso: string;
}): CustomerBook {
  const now = timeOf(input.nowIso) || Date.now();
  const accounts = new Map<string, WorkingAccount>();

  const entryFor = (name: string): WorkingAccount | null => {
    const key = keyOf(name);
    if (!key) return null;
    let account = accounts.get(key);
    if (!account) {
      account = emptyAccount("", 0);
      accounts.set(key, account);
    }
    return account;
  };

  for (const row of input.activity) {
    const account = entryFor(row.companyName);
    if (!account) continue;
    displayNameFor(account, row.companyName, row.updatedAt || row.createdAt);
    touch(account, row.createdAt);
    touch(account, row.updatedAt);
    account.leadScore = Math.max(account.leadScore, Math.max(0, row.score));
    if (row.source === "opportunity") {
      const stage = clean(row.stage).toLowerCase();
      const value = Math.max(0, Math.round(row.valueCents));
      if (stage === "won") {
        account.wonCents += value;
      } else if (stage === "lost") {
        account.hasLost = true;
      } else {
        account.openOpportunities += 1;
        account.pipelineCents += value;
      }
    }
  }

  for (const row of input.ledger) {
    const account = entryFor(row.companyName);
    if (!account) continue;
    displayNameFor(account, row.companyName, row.createdAt);
    touch(account, row.createdAt);
    const amount = Math.max(0, Math.round(row.amountCents));
    if (row.kind === "invoice") {
      account.invoicedCents += amount;
      if (row.status === "issued") {
        account.outstandingCents += amount;
        if (now - timeOf(row.createdAt) > 7 * DAY_MS) account.overdueCents += amount;
      }
    } else if (row.kind === "receipt") {
      account.receivedCents += amount;
    }
  }

  const plansByCreated = [...input.plans].sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt));
  for (const row of plansByCreated) {
    const account = entryFor(row.companyName);
    if (!account) continue;
    displayNameFor(account, row.companyName, row.createdAt);
    touch(account, row.createdAt);
    if (clean(row.contactName ?? "")) account.contactName = clean(row.contactName ?? "");
    if (clean(row.contactEmail ?? "")) account.contactEmail = clean(row.contactEmail ?? "");
    if (row.status !== "active") continue;
    account.activeSubscriptions += 1;
    account.monthlyRecurringCents += monthlyValue(Math.max(0, row.priceCents), row.cycle);
    if (!account.planIds.includes(row.planId)) account.planIds.push(row.planId);
    if (!account.nextBillingAt || timeOf(row.nextBillingAt) < timeOf(account.nextBillingAt)) {
      account.nextBillingAt = row.nextBillingAt;
    }
  }

  const result = [...accounts.values()].map((account): CustomerAccount => {
    if (
      account.activeSubscriptions > 0 ||
      account.invoicedCents > 0 ||
      account.receivedCents > 0 ||
      account.wonCents > 0
    ) {
      account.status = "client";
    } else if (account.hasLost && account.openOpportunities === 0 && account.pipelineCents === 0) {
      account.status = "lost";
    } else {
      account.status = "prospect";
    }
    if (
      account.activeSubscriptions > 0 &&
      account.nextBillingAt &&
      timeOf(account.nextBillingAt) < now - 14 * DAY_MS
    ) {
      account.churnRisk = true;
    }
    if (account.overdueCents > 0) account.churnRisk = true;
    return {
      companyName: account.companyName,
      status: account.status,
      contactName: account.contactName,
      contactEmail: account.contactEmail,
      leadScore: account.leadScore,
      openOpportunities: account.openOpportunities,
      pipelineCents: account.pipelineCents,
      wonCents: account.wonCents,
      invoicedCents: account.invoicedCents,
      receivedCents: account.receivedCents,
      outstandingCents: account.outstandingCents,
      overdueCents: account.overdueCents,
      activeSubscriptions: account.activeSubscriptions,
      monthlyRecurringCents: account.monthlyRecurringCents,
      planIds: account.planIds,
      nextBillingAt: account.nextBillingAt,
      firstSeenAt: account.firstSeenAt,
      lastActivityAt: account.lastActivityAt,
      churnRisk: account.churnRisk,
    };
  });

  result.sort((a, b) => {
    if (a.churnRisk !== b.churnRisk) return a.churnRisk ? -1 : 1;
    if (a.overdueCents !== b.overdueCents) return b.overdueCents - a.overdueCents;
    if (a.outstandingCents !== b.outstandingCents) return b.outstandingCents - a.outstandingCents;
    const byActivity = (timeOf(b.lastActivityAt) || 0) - (timeOf(a.lastActivityAt) || 0);
    if (byActivity !== 0) return byActivity;
    return a.companyName.localeCompare(b.companyName);
  });

  return { accounts: result, summary: summarizeCustomerAccounts(result) };
}

export function summarizeCustomerAccounts(accounts: CustomerAccount[]): CustomerBookSummary {
  const summary: CustomerBookSummary = {
    accounts: accounts.length,
    clients: 0,
    prospects: 0,
    lost: 0,
    activeSubscriptions: 0,
    monthlyRecurringCents: 0,
    invoicedCents: 0,
    receivedCents: 0,
    outstandingCents: 0,
    overdueCents: 0,
    churnRisk: 0,
  };
  for (const account of accounts) {
    if (account.status === "client") summary.clients += 1;
    else if (account.status === "prospect") summary.prospects += 1;
    else summary.lost += 1;
    summary.activeSubscriptions += account.activeSubscriptions;
    summary.monthlyRecurringCents += account.monthlyRecurringCents;
    summary.invoicedCents += account.invoicedCents;
    summary.receivedCents += account.receivedCents;
    summary.outstandingCents += account.outstandingCents;
    summary.overdueCents += account.overdueCents;
    if (account.churnRisk) summary.churnRisk += 1;
  }
  return summary;
}

export function planLabel(planId: string): string {
  return planById(planId)?.title ?? planId;
}

export function customerAccountsToCsv(accounts: CustomerAccount[]): string {
  const header = [
    "company",
    "status",
    "contact_name",
    "contact_email",
    "monthly_recurring_zar",
    "invoiced_zar",
    "received_zar",
    "outstanding_zar",
    "overdue_zar",
    "pipeline_zar",
    "won_zar",
    "active_subscriptions",
    "plans",
    "next_billing_at",
    "last_activity_at",
    "churn_risk",
  ];
  const rows = accounts.map((account) =>
    [
      account.companyName,
      account.status,
      account.contactName,
      account.contactEmail,
      (account.monthlyRecurringCents / 100).toFixed(2),
      (account.invoicedCents / 100).toFixed(2),
      (account.receivedCents / 100).toFixed(2),
      (account.outstandingCents / 100).toFixed(2),
      (account.overdueCents / 100).toFixed(2),
      (account.pipelineCents / 100).toFixed(2),
      (account.wonCents / 100).toFixed(2),
      account.activeSubscriptions,
      account.planIds.map(planLabel).join("; "),
      account.nextBillingAt,
      account.lastActivityAt,
      account.churnRisk ? "yes" : "no",
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...rows].join("\r\n");
}
