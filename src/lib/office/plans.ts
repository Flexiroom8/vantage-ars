/**
 * Productised services — the things the office can deliver on its own.
 *
 * A productised service is a fixed scope, a published price, and a deliverable
 * the office can produce from its own records. That last part is the whole
 * point: a service the office can deliver is a service the office can bill
 * without a human being in the loop, and a service it can bill on a schedule
 * is recurring revenue rather than a job.
 *
 * Every plan here is remote-only and every deliverable is assembled from
 * tickets, quotes, invoices and measurements the office already holds. Nothing
 * in this file promises monitoring, uptime, or an SLA — those are the things a
 * customer cannot verify and a business should never sell.
 *
 * Pure module. No database, no clock, no environment.
 */
import { PUBLISHED_RATES } from "./catalogue";

export type PlanCycle = "once" | "monthly" | "quarterly";

export type PlanDefinition = {
  /** The plan id. It is also the published rate id, so one line, one price. */
  id: string;
  title: string;
  rateId: string;
  cycle: PlanCycle;
  priceCents: number;
  /** One sentence a customer can read on the page. */
  headline: string;
  /** What the customer actually receives. */
  deliverable: string;
  /** True when the office can produce the deliverable from its own records. */
  automatic: boolean;
  /** Any human labour the plan includes. Null when the plan is entirely office work. */
  humanLabour: string | null;
  includes: string[];
  excludes: string[];
};

function ratePriceCents(rateId: string): number {
  const rate = PUBLISHED_RATES.find((item) => item.id === rateId);
  if (!rate) return 0;
  const match = rate.price.replace(/,/g, "").match(/R\s*([\d.]+)/);
  return match ? Math.round(Number(match[1]) * 100) || 0 : 0;
}

const PLAN_LIST: PlanDefinition[] = [
  {
    id: "managed-support",
    title: "Managed support plan",
    rateId: "managed-support",
    cycle: "monthly",
    priceCents: ratePriceCents("managed-support"),
    headline:
      "Remote support on a monthly plan, with the triage, the reporting and the invoicing handled for you.",
    deliverable:
      "A monthly managed service report, automatic triage of every fault you raise, and a quarterly infrastructure review.",
    automatic: true,
    humanLabour: "The included remote support hours are performed by a Vantage-ARS engineer.",
    includes: [
      "8 hours of included remote support each month",
      "A managed service report every month",
      "A quarterly infrastructure review",
      "Every fault triaged without you chasing us",
    ],
    excludes: [
      "On-site work, hardware, third-party licences and carrier costs",
      "After-hours work, which is quoted separately",
      "Anything outside the published rate card",
    ],
  },
  {
    id: "health-watch",
    title: "Remote health and spend watch",
    rateId: "health-watch",
    cycle: "monthly",
    priceCents: ratePriceCents("health-watch"),
    headline:
      "A written watch over your open faults, our response times and your spend, every month.",
    deliverable:
      "A monthly watch report covering open faults, ageing tickets, response against our own targets, and everything invoiced in the period.",
    automatic: true,
    humanLabour: null,
    includes: [
      "A monthly written watch report",
      "Open faults and ageing items listed",
      "Spend reconciled against the published rate card",
    ],
    excludes: ["Monitoring of your live estate", "On-site work and third-party costs"],
  },
  {
    id: "service-report",
    title: "Service report",
    rateId: "service-report",
    cycle: "once",
    priceCents: ratePriceCents("service-report"),
    headline: "A written account of what we did for you, and what it cost.",
    deliverable:
      "A report covering every fault raised, every quote issued and every invoice raised in the period, in plain language.",
    automatic: true,
    humanLabour: null,
    includes: [
      "Every fault raised in the period",
      "Every quote and invoice in the period",
      "Open items and what is still outstanding",
    ],
    excludes: ["Any new work — this reports on work already done"],
  },
  {
    id: "billing-audit",
    title: "Billing and rate compliance audit",
    rateId: "billing-audit",
    cycle: "once",
    priceCents: ratePriceCents("billing-audit"),
    headline: "Every invoice we issued you, checked line by line against the published rate card.",
    deliverable:
      "An audit of the invoices issued in the period, each matched to the published rate line it came from, with anything that does not match called out.",
    automatic: true,
    humanLabour: null,
    includes: [
      "Every invoice in the period, checked against the published card",
      "A named rate line for each invoice that matches",
      "A list of anything that does not reconcile",
    ],
    excludes: ["Supplier and carrier invoices, which are not ours to audit"],
  },
  {
    id: "handover-pack",
    title: "Infrastructure documentation and handover pack",
    rateId: "handover-pack",
    cycle: "once",
    priceCents: ratePriceCents("handover-pack"),
    headline: "Your network and phone estate, written down so anyone can pick it up.",
    deliverable:
      "A handover document built from the work the office has recorded for you: the equipment seen, the faults fixed, the configurations changed, and what is still open.",
    automatic: true,
    humanLabour: null,
    includes: [
      "A written record of the faults we have resolved",
      "A written record of the changes we have made",
      "An open-items list for whoever takes over",
    ],
    excludes: [
      "Site drawings and cabling schedules",
      "Anything we have not worked on and cannot see",
    ],
  },
  {
    id: "continuity-plan",
    title: "Business continuity plan",
    rateId: "continuity-plan",
    cycle: "once",
    priceCents: ratePriceCents("continuity-plan"),
    headline: "What breaks your business, what it costs, and what to do first.",
    deliverable:
      "A continuity plan built from your recorded fault history: the failure points we have actually seen, the order to recover them in, and the gaps.",
    automatic: true,
    humanLabour: null,
    includes: [
      "The failure points we have actually recorded for you",
      "A recovery order, most damaging first",
      "The gaps we can see from the record",
    ],
    excludes: ["A formal disaster recovery or compliance certification", "Penetration testing"],
  },
  {
    id: "sla-review",
    title: "Service level and response review",
    rateId: "sla-review",
    cycle: "once",
    priceCents: ratePriceCents("sla-review"),
    headline: "How we actually performed, measured against our own written targets.",
    deliverable:
      "A review of the faults raised in the period, how long each took to pick up and resolve, and how that compares with our published internal response targets.",
    automatic: true,
    humanLabour: null,
    includes: [
      "Fault counts by severity",
      "Measured first-response and resolution times",
      "A comparison against our internal response targets",
    ],
    excludes: ["A contractual SLA — we publish our targets, we do not sell a guarantee"],
  },
];

export const PLANS: PlanDefinition[] = PLAN_LIST;

export function planById(id: string): PlanDefinition | undefined {
  return PLANS.find((plan) => plan.id === id);
}

/** The plan behind a published rate line, if that line is a productised service. */
export function planForRate(rateId: string): PlanDefinition | undefined {
  return PLANS.find((plan) => plan.rateId === rateId);
}

/** Plans that bill on a schedule, and so are the recurring-revenue products. */
export function recurringPlans(): PlanDefinition[] {
  return PLANS.filter((plan) => plan.cycle !== "once");
}

/**
 * A plan is only sellable if its published rate exists, is offered, and still
 * carries the price the plan quotes. The office checks this before it prices
 * anything, so a rate card edit can never leave a plan selling at a figure the
 * public site no longer shows.
 */
export function planIntegrity(): { ok: boolean; detail: string } {
  const broken: string[] = [];
  for (const plan of PLANS) {
    const rate = PUBLISHED_RATES.find((item) => item.id === plan.rateId);
    if (!rate) {
      broken.push(`${plan.id}: no published rate line`);
      continue;
    }
    if (!rate.offered) {
      broken.push(`${plan.id}: the published rate is not offered`);
      continue;
    }
    if (ratePriceCents(plan.rateId) !== plan.priceCents) {
      broken.push(`${plan.id}: the published price no longer matches the plan`);
    }
  }
  if (broken.length) return { ok: false, detail: broken.join("; ") };
  return {
    ok: true,
    detail: `${PLANS.length} productised services, ${recurringPlans().length} of them recurring.`,
  };
}
