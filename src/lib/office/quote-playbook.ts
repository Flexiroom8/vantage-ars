/**
 * The first quote a sales agent may put together without a founder.
 *
 * This is deliberately conservative. It does not invent scope, a project
 * price, a discount, travel or a supplier figure. It maps what the customer
 * actually asked for onto ONE published labour line, and defaults to the
 * paid initial assessment when the request is not specific enough to do
 * better. A detailed quote can follow once the assessment has produced facts.
 */
import { PUBLISHED_RATES } from "./catalogue";
import { priceQuote, type QuoteLocation } from "./quote";

export type QuotePlaybookInput = {
  companyName: string;
  summary: string;
};

export type QuoteChoice = {
  rateId: string;
  location: QuoteLocation;
  quantity: number;
  amountCents: number;
  title: string;
  detail: string;
  why: string;
};

type Candidate = {
  rateId: string;
  location: QuoteLocation;
  quantity: number;
  why: string;
};

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

/** A whole, published, offered line. Withheld lines are never auto-quoted. */
function offered(rateId: string): boolean {
  return PUBLISHED_RATES.some((rate) => rate.id === rateId && rate.offered);
}

function hoursIn(text: string): number | null {
  const hours = /(\d+(?:[.,]\d+)?)\s*(?:hours?|hrs?)\b/i.exec(text);
  if (hours) return Number(hours[1].replace(",", "."));
  const minutes = /(\d+)\s*(?:minutes?|mins?)\b/i.exec(text);
  if (minutes) return Number(minutes[1]) / 60;
  return null;
}

function pointsIn(text: string): number | null {
  const points = /(\d+)\s*(?:network\s+)?(?:points?|cable\s+points?|data\s+points?)\b/i.exec(text);
  if (!points) return null;
  const value = Number(points[1]);
  return Number.isInteger(value) && value >= 1 && value <= 40 ? value : null;
}

const PRODUCTS: Candidate[] = [
  {
    rateId: "managed-support",
    location: "remote",
    quantity: 1,
    why: "the customer asked for an ongoing managed support arrangement",
  },
  {
    rateId: "health-watch",
    location: "remote",
    quantity: 1,
    why: "the customer asked for a recurring health and spend watch",
  },
  {
    rateId: "billing-audit",
    location: "remote",
    quantity: 1,
    why: "the customer asked for a billing or rate compliance audit",
  },
  {
    rateId: "handover-pack",
    location: "remote",
    quantity: 1,
    why: "the customer asked for documentation or a handover pack",
  },
  {
    rateId: "continuity-plan",
    location: "remote",
    quantity: 1,
    why: "the customer asked for a business continuity plan",
  },
  {
    rateId: "sla-review",
    location: "remote",
    quantity: 1,
    why: "the customer asked for a service-level or response review",
  },
  {
    rateId: "service-report",
    location: "remote",
    quantity: 1,
    why: "the customer asked for a written service report",
  },
];

export function chooseQuote(input: QuotePlaybookInput): QuoteChoice | null {
  const text = `${input.companyName} ${input.summary}`.toLowerCase();
  if (!text.trim()) return null;

  const onsite = has(
    text,
    /\b(on[\s-]?site|onsite|site visit|at our (office|premises)|come to us)\b/,
  );
  const afterHours = has(text, /\b(after[\s-]?hours|weekend|evening|overnight)\b/);
  const fault = has(
    text,
    /\b(fault|broken|down|fix|repair|maintenance|not working|no dial|one-way|dropping|outage)\b/,
  );
  const voip = has(text, /\b(voip|pbx|pabx|sip|phone|phones|telephone|extension|extensions)\b/);
  const network = has(text, /\b(network|networking|wifi|wi-fi|switch|router|vlan|cabling|cable)\b/);
  const infrastructure = has(
    text,
    /\b(server|servers|infrastructure|firewall|backup|backups|nas|vmware|hyper-v|proxmox)\b/,
  );
  const design = has(text, /\b(design|migration|migrate|plan|sizing|porting)\b/);
  const install = has(text, /\b(install|installation|configure|configuration|setup|set up)\b/);
  const survey = has(text, /\b(survey|site survey|discovery|assess|assessment|scoping)\b/);

  const product = PRODUCTS.find((candidate) => {
    switch (candidate.rateId) {
      case "managed-support":
        return has(text, /\bmanaged (support|service|plan)\b|\bretainer\b|\bmonthly support\b/);
      case "health-watch":
        return has(text, /\bhealth (and|&) spend watch\b|\bhealth watch\b/);
      case "billing-audit":
        return has(text, /\bbilling (and|&) rate (audit|compliance)\b|\bbilling audit\b/);
      case "handover-pack":
        return has(text, /\bhandover (pack|documentation)\b|\bdocumentation pack\b/);
      case "continuity-plan":
        return has(text, /\bbusiness continuity\b|\bcontinuity plan\b/);
      case "sla-review":
        return has(text, /\bservice level\b|\bresponse review\b|\bsla review\b/);
      case "service-report":
        return has(text, /\bservice report\b|\bwritten report\b/);
      default:
        return false;
    }
  });
  if (product) return toChoice(product);

  if (network) {
    const points = pointsIn(text);
    if (points) {
      return toChoice({
        rateId: "network-point",
        location: "onsite",
        quantity: points,
        why: `the customer named ${points} structured network point(s)`,
      });
    }
  }

  if (onsite) {
    if (fault || install) {
      return toChoice({
        rateId: "onsite-support",
        location: "onsite",
        quantity: 2,
        why: "the customer asked for on-site support, and the published two-hour minimum is the smallest honest booking",
      });
    }
    return toChoice({
      rateId: "survey",
      location: "onsite",
      quantity: 2,
      why: "the customer asked for an on-site visit or survey, and travel is excluded",
    });
  }

  if (afterHours) {
    return toChoice({
      rateId: "after-hours",
      location: "remote",
      quantity: 0.25,
      why: "the customer asked for after-hours work, quoted at the published minimum",
    });
  }

  const hours = hoursIn(text);
  if (hours !== null) {
    const quantity = Math.max(0.5, Math.ceil(hours * 4) / 4);
    if (quantity <= 8) {
      return toChoice({
        rateId: "remote-support",
        location: "remote",
        quantity,
        why: "the customer named the labour time they expect, so the published hourly line is used",
      });
    }
  }

  if (voip && fault) {
    return toChoice({
      rateId: "voip-diagnosis",
      location: "remote",
      quantity: 0.5,
      why: "the customer reported a VoIP fault and the first step is diagnosis, not a promised fix",
    });
  }

  if (voip && design) {
    return toChoice({
      rateId: "pbx-design",
      location: "remote",
      quantity: 0.5,
      why: "the customer asked for PBX design or migration work",
    });
  }

  if (voip && install) {
    return toChoice({
      rateId: "pbx-install",
      location: "remote",
      quantity: 0.5,
      why: "the customer asked for VoIP installation or configuration labour",
    });
  }

  if (infrastructure) {
    return toChoice({
      rateId: "infra-assessment",
      location: "remote",
      quantity: 0.5,
      why: "the customer described an infrastructure issue, so the first step is a bounded assessment",
    });
  }

  if (network && survey) {
    return toChoice({
      rateId: "survey",
      location: "onsite",
      quantity: 2,
      why: "the customer asked for a network survey or assessment",
    });
  }

  return toChoice({
    rateId: "assessment",
    location: "remote",
    quantity: 1,
    why: "the enquiry is real but not specific enough to price beyond a paid initial assessment",
  });
}

function toChoice(candidate: Candidate): QuoteChoice | null {
  if (!offered(candidate.rateId)) return null;
  const priced = priceQuote({
    rateId: candidate.rateId,
    location: candidate.location,
    quantity: candidate.quantity,
  });
  if (!priced.ok) return null;
  return {
    rateId: candidate.rateId,
    location: candidate.location,
    quantity: candidate.quantity,
    amountCents: priced.cents,
    title: priced.title,
    detail: priced.detail,
    why: candidate.why,
  };
}

/**
 * Extra scope prose the office may attach to the generated quote.
 *
 * These lines state limits, never promises. The store still filters them
 * through the same promise/money guard as every other quote.
 */
export function quoteScopeLines(choice: QuoteChoice): string[] {
  return [
    `This quote covers the published ${choice.title} line for the quantity stated above.`,
    "Systems, access and a workable schedule are confirmed before the work is booked.",
    "Parts, licences, carrier changes and travel are not included and are quoted separately if needed.",
  ];
}
