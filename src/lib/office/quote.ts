import { formatZar } from "./money.ts";

export type QuoteLocation = "remote" | "onsite";

type QuoteSpec = {
  rateId: string;
  location: QuoteLocation;
  title: string;
  unit: "hour" | "point" | "flat";
  cents: number;
  min: number;
  step: number;
  note: string;
  /** How the quantity reads in the priced detail. Defaults to a unit phrase. */
  measure?: string;
  /** The line that closes the priced detail. */
  footer?: string;
};

/** Single published figures only. Ranges, travel, and supplier prices are refused. */
export const QUOTE_SPECS: QuoteSpec[] = [
  {
    rateId: "remote-support",
    location: "remote",
    title: "Remote technical support",
    unit: "hour",
    cents: 69000,
    min: 0.5,
    step: 0.25,
    note: "30-minute minimum, then 15-minute increments.",
  },
  {
    rateId: "onsite-support",
    location: "onsite",
    title: "On-site technical support",
    unit: "hour",
    cents: 80500,
    min: 2,
    step: 0.25,
    note: "Two-hour minimum. Travel is not included.",
  },
  {
    rateId: "after-hours",
    location: "remote",
    title: "After-hours support, remote",
    unit: "hour",
    cents: 103500,
    min: 0.25,
    step: 0.25,
    note: "1.5× remote labour. Not an emergency response.",
  },
  {
    rateId: "after-hours",
    location: "onsite",
    title: "After-hours support, on-site",
    unit: "hour",
    cents: 120750,
    min: 0.25,
    step: 0.25,
    note: "Published on-site after-hours labour. Travel is not included.",
  },
  {
    rateId: "assessment",
    location: "remote",
    title: "Initial remote assessment",
    unit: "flat",
    cents: 69000,
    min: 1,
    step: 1,
    note: "Up to 60 minutes. Chargeable unless a later quote credits it.",
  },
  {
    rateId: "survey",
    location: "onsite",
    title: "Site survey and written recommendation",
    unit: "hour",
    cents: 80500,
    min: 2,
    step: 0.25,
    note: "Two-hour minimum. Travel is not included.",
  },
  {
    rateId: "network-point",
    location: "onsite",
    title: "Structured network point",
    unit: "point",
    cents: 80500,
    min: 1,
    step: 1,
    note: "Labour per point. Materials are not included.",
  },
  {
    rateId: "voip-diagnosis",
    location: "remote",
    title: "VoIP fault diagnosis, remote",
    unit: "hour",
    cents: 69000,
    min: 0.25,
    step: 0.25,
    note: "Labour only. No restoration guarantee.",
  },
  {
    rateId: "voip-diagnosis",
    location: "onsite",
    title: "VoIP fault diagnosis, on-site",
    unit: "hour",
    cents: 80500,
    min: 0.25,
    step: 0.25,
    note: "Labour only. Travel is not included.",
  },
  {
    rateId: "pbx-design",
    location: "remote",
    title: "Hosted PBX / SIP design",
    unit: "hour",
    cents: 80500,
    min: 0.25,
    step: 0.25,
    note: "Design labour. Carrier, licences, and handsets are not included.",
  },
  {
    rateId: "pbx-install",
    location: "remote",
    title: "VoIP / PBX installation, remote",
    unit: "hour",
    cents: 69000,
    min: 0.25,
    step: 0.25,
    note: "Hourly labour. Not a fixed project price.",
  },
  {
    rateId: "pbx-install",
    location: "onsite",
    title: "VoIP / PBX installation, on-site",
    unit: "hour",
    cents: 80500,
    min: 0.25,
    step: 0.25,
    note: "Hourly labour. Not a fixed project price. Travel is not included.",
  },
  {
    rateId: "infra-assessment",
    location: "remote",
    title: "IT infrastructure assessment, remote",
    unit: "hour",
    cents: 69000,
    min: 0.25,
    step: 0.25,
    note: "Findings labour. Certification is not included.",
  },
  {
    rateId: "infra-assessment",
    location: "onsite",
    title: "IT infrastructure assessment, on-site",
    unit: "hour",
    cents: 80500,
    min: 2,
    step: 0.25,
    note: "Two-hour minimum on-site. Travel is not included.",
  },
  {
    rateId: "infra-change",
    location: "remote",
    title: "IT infrastructure implementation, remote",
    unit: "hour",
    cents: 69000,
    min: 0.25,
    step: 0.25,
    note: "Hourly labour. Hardware and licences are not included.",
  },
  {
    rateId: "infra-change",
    location: "onsite",
    title: "IT infrastructure implementation, on-site",
    unit: "hour",
    cents: 80500,
    min: 0.25,
    step: 0.25,
    note: "Hourly labour. Hardware, licences, and travel are not included.",
  },
  {
    rateId: "managed-support",
    location: "remote",
    title: "Managed support plan",
    unit: "flat",
    cents: 275000,
    min: 1,
    step: 1,
    note: "One month of the managed support plan, including eight remote support hours and the monthly service report.",
    measure: "One month of managed support",
    footer:
      "This is a remote managed service. It is billed for one period at a time and the period renews monthly.",
  },
  {
    rateId: "health-watch",
    location: "remote",
    title: "Remote health and spend watch",
    unit: "flat",
    cents: 99000,
    min: 1,
    step: 1,
    note: "One month of the watch, compiled from our own records.",
    measure: "One month of the watch",
    footer: "This is a remote managed service. It renews monthly.",
  },
  {
    rateId: "service-report",
    location: "remote",
    title: "Service report",
    unit: "flat",
    cents: 69000,
    min: 1,
    step: 1,
    note: "One written report of the work recorded in the period.",
    measure: "One report",
    footer: "This is a one-off report. It covers work already recorded; it includes no new work.",
  },
  {
    rateId: "billing-audit",
    location: "remote",
    title: "Billing and rate compliance audit",
    unit: "flat",
    cents: 115000,
    min: 1,
    step: 1,
    note: "One audit of the invoices issued in the period, checked against the published rate card.",
    measure: "One audit",
    footer: "This is a one-off audit. Nothing is adjusted without your agreement.",
  },
  {
    rateId: "handover-pack",
    location: "remote",
    title: "Infrastructure documentation and handover pack",
    unit: "flat",
    cents: 138000,
    min: 1,
    step: 1,
    note: "One handover pack, built from the work we have recorded for you.",
    measure: "One pack",
    footer: "This is a one-off pack. It is not a site survey.",
  },
  {
    rateId: "continuity-plan",
    location: "remote",
    title: "Business continuity plan",
    unit: "flat",
    cents: 172500,
    min: 1,
    step: 1,
    note: "One plan, built from your recorded fault history.",
    measure: "One plan",
    footer: "This is a one-off plan. It is not a formal disaster recovery plan.",
  },
  {
    rateId: "sla-review",
    location: "remote",
    title: "Service level and response review",
    unit: "flat",
    cents: 69000,
    min: 1,
    step: 1,
    note: "One review of how the faults in the period were handled, measured against our own targets.",
    measure: "One review",
    footer:
      "This is a one-off review. Our response targets are working targets, not a contractual service level.",
  },
];

export type QuotePrice =
  | { ok: true; cents: number; title: string; detail: string; body: string }
  | { ok: false; error: string };

export function priceQuote(input: {
  rateId: string;
  location: QuoteLocation;
  quantity: number;
}): QuotePrice {
  const spec = QUOTE_SPECS.find(
    (item) => item.rateId === input.rateId && item.location === input.location,
  );
  if (!spec) {
    return {
      ok: false,
      error:
        "That line has no single published figure. Ranges, travel, and supplier prices are not quoted here.",
    };
  }
  if (spec.unit === "flat") {
    return okPrice(spec, 1, spec.cents);
  }
  const quantity = input.quantity;
  if (!Number.isFinite(quantity) || quantity < spec.min || quantity > 40) {
    return { ok: false, error: `Quantity must be between ${spec.min} and 40.` };
  }
  const units = Math.round(quantity / spec.step);
  if (Math.abs(units * spec.step - quantity) > 0.001) {
    return { ok: false, error: `Use increments of ${spec.step}.` };
  }
  if (spec.unit === "point" && !Number.isInteger(quantity)) {
    return { ok: false, error: "Network points are whole numbers." };
  }
  return okPrice(spec, quantity, Math.round(quantity * spec.cents));
}

function okPrice(spec: QuoteSpec, quantity: number, cents: number): QuotePrice {
  const amount = formatZar(cents);
  const measure =
    spec.measure ??
    (spec.unit === "flat"
      ? "One assessment"
      : spec.unit === "point"
        ? `${quantity} point(s)`
        : `${quantity} hour(s)`);
  const detail = `${spec.title}. ${measure}. ${spec.note} Labour ${amount}.`;
  const body = [
    "INTERNAL QUOTE DRAFT. This has not been sent.",
    detail,
    "VAT treatment is not decided here.",
    spec.footer ?? "Scope and exclusions are stated on the written quote before work starts.",
  ].join(" ");
  return { ok: true, cents, title: spec.title, detail, body };
}

/** Phrases that would turn a priced document into a promise the office cannot keep. */
const PROMISE_PATTERNS: RegExp[] = [
  /\bguarantee[ds]?\b/i,
  /\bguaranteed\b/i,
  /\b24\/7\b/i,
  /\bwithin \d+\s*(hour|day|minute)/i,
  /\bfixed price\b/i,
  /\bdiscount\b/i,
  /\bfree\b/i,
  /\bno charge\b/i,
  /\bwe will (restore|resolve|fix)/i,
  /\buptime\b/i,
  /\bsla\b/i,
  /\bcheapest\b/i,
  /\bbest price\b/i,
];

/** Any money the office has not published. */
const FIGURE = /r\s?\d[\d\s.,]*/gi;

/**
 * Lines Sales may add to a quote on top of the priced detail.
 *
 * The priced figure and the reference are always generated from the rate card —
 * they are never taken from the agent. This only governs the extra scope prose,
 * and it is deliberately strict: no promises, no discounts, no SLA language,
 * and no money figure other than the published one. Anything that fails is
 * dropped, not silently served to a customer.
 */
export function acceptedScopeLines(lines: unknown, publishedCents: number): string[] {
  if (!Array.isArray(lines)) return [];
  const published = formatZar(publishedCents).replace(/\s/g, "");
  const accepted: string[] = [];
  for (const raw of lines.slice(0, 8)) {
    if (typeof raw !== "string") continue;
    const line = raw.replace(/\s+/g, " ").trim().slice(0, 240);
    if (line.length < 3) continue;
    if (PROMISE_PATTERNS.some((pattern) => pattern.test(line))) continue;
    const figures = line.match(FIGURE) ?? [];
    // A money figure is only allowed if it is exactly the published figure.
    if (
      figures.some((figure) => figure.replace(/\s/g, "").toLowerCase() !== published.toLowerCase())
    )
      continue;
    accepted.push(line);
  }
  return accepted;
}

export type QuoteDocument =
  { ok: true; body: string; cents: number; title: string } | { ok: false; error: string };

/**
 * Build the stored quote document. The customer-visible text is generated here
 * from `QUOTE_SPECS`, not assembled from agent prose, so the published figure
 * on the document is by construction the published figure.
 */
export function buildQuoteDocument(input: {
  rateId: unknown;
  location: unknown;
  quantity: unknown;
  amountCents: number;
  reference: string;
  scope?: unknown;
}): QuoteDocument {
  const location = input.location === "onsite" ? "onsite" : "remote";
  const priced = priceQuote({
    rateId: String(input.rateId ?? ""),
    location,
    quantity: Number(input.quantity),
  });
  if (!priced.ok) return priced;
  if (priced.cents !== input.amountCents) {
    return { ok: false, error: "Quote amount does not match the published rate." };
  }
  const scope = acceptedScopeLines(input.scope, priced.cents);
  const parts = [
    "INTERNAL QUOTE DRAFT. This has not been sent.",
    priced.detail,
    ...scope,
    `Reference: ${input.reference}.`,
    "Scope, exclusions and the VAT treatment are stated on the written quote before work starts.",
  ];
  return { ok: true, body: parts.join(" "), cents: priced.cents, title: priced.title };
}
