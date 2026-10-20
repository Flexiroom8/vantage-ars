/**
 * Risk tiers for the office.
 *
 * Why this module exists: the governor answers "may this happen under the
 * constitution", but the founder still needs one word that says how much of
 * their judgement an action is asking for. A drafted reply and a cancelled
 * subscription can both be lawful, yet only one of them is the sort of thing a
 * person should be asked about. This module names that difference once, so the
 * governor, the store and the founder's screen all speak the same language.
 *
 * What it deliberately does not do:
 *   - it does not decide whether an action is permitted. That is the
 *     governor's job, and the constitution's;
 *   - it does not score confidence or invent a number that looks like a
 *     probability. A tier is a label a human can argue with;
 *   - it does not read the clock, the database, the network, or the
 *     environment, and it calls nothing;
 *   - it does not try to guess whether a "company" is a natural person from
 *     its name. A sole trader and a close corporation look identical on this
 *     record, and a trading name that happens to contain a person's name is
 *     not evidence either way. Personal-data reach is therefore decided from
 *     the ACTION KIND alone, which is auditable and repeatable.
 *
 * Tiers, in order of consequence:
 *   1-Legal      the output decides something about a natural person;
 *   1-Financial  money leaves the company, or a large sum is committed;
 *   2-Destructive  the action cannot be undone cleanly;
 *   3-Value      real value is created or committed;
 *   4-Ambiguous  judgement is needed but nothing outside the office moves;
 *   5-Routine    ordinary work the office may do on its own.
 *
 * Where the brief and the action list overlap, the more consequential tier
 * wins. Two overlaps are worth naming out loud:
 *   - `escalate_account_risk` is Tier 1-Legal. It judges an account holder,
 *     so it always decides something about a person, whatever the amount.
 *   - `route_inbound` is Tier 4-Ambiguous. Classifying an inbound message is
 *     the classic judgement call; it does not become routine just because it
 *     is common.
 *
 * Pure module: no database, no clock, no environment. Unit tested directly.
 */
import { formatZar } from "./money.ts";
import { ACTION_KINDS } from "./types.ts";

export type RiskTier = 1 | 2 | 3 | 4 | 5;

export type RiskTierName =
  "1-Legal" | "1-Financial" | "2-Destructive" | "3-Value" | "4-Ambiguous" | "5-Routine";

export type RiskAssessment = {
  tier: RiskTier;
  name: RiskTierName;
  rationale: string;
  /** True when the action needs a human before it can touch the outside world. */
  gated: boolean;
  /** True when the action affects a natural person and §71 may apply. */
  personalData: boolean;
};

/**
 * The high-value line, in cents: R25 000.00.
 *
 * At or above this amount a decision stops being ordinary bookkeeping. The
 * governor has its own rules; this is the risk module's line, and it is
 * published here so the two can be compared rather than guessed at.
 */
export const HIGH_VALUE_CENTS = 2_500_000;

/** One plain sentence per tier, for the founder's screen and the audit trail. */
export const RISK_TIER_LABELS: Record<RiskTierName, string> = {
  "1-Legal":
    "This decides something about a person, so POPIA section 71 may apply and a human must be involved before it happens.",
  "1-Financial":
    "Money leaves the company or a large sum is committed, so the founder must approve it.",
  "2-Destructive": "This cannot be undone cleanly, so the founder must approve it.",
  "3-Value": "This creates or commits real value, so the founder must approve it.",
  "4-Ambiguous":
    "This needs judgement but moves nothing outside the office, so the office may act on it.",
  "5-Routine":
    "This is ordinary work with no money, no customer and no commitment, so the office may act on it alone.",
};

/** The tier number behind each tier name. */
const TIER_OF_NAME: Record<RiskTierName, RiskTier> = {
  "1-Legal": 1,
  "1-Financial": 1,
  "2-Destructive": 2,
  "3-Value": 3,
  "4-Ambiguous": 4,
  "5-Routine": 5,
};

/** Tiers that a human must clear before the action reaches the outside world. */
const GATED_TIERS = new Set<RiskTier>([1, 2, 3]);

/**
 * Action kinds whose output decides something about a natural person.
 *
 * These are the ones POPIA section 71 can reach. The set is closed on purpose:
 * "might involve a person" is not a useful test, because then every tier
 * would be legal-reachable and the tier would stop carrying information.
 */
const LEGAL_KINDS = new Set(["propose_close_lost", "escalate_account_risk", "cancel_subscription"]);

/**
 * Action kinds that commit money leaving the company.
 *
 * Amount does not change these: an expense of R1 still spends the company's
 * money, and a campaign of any size still puts spend behind it.
 */
const FINANCIAL_KINDS = new Set(["record_expense", "activate_campaign"]);

/** Action kinds that create real value or a real commitment. */
const VALUE_KINDS = new Set(["issue_quote", "open_opportunity"]);

/**
 * Action kinds that need judgement but touch nothing outside the office.
 *
 * `route_inbound` classifies and routes an inbound message; `update_lead`
 * edits a record; `handoff_to_sales` moves work to another department.
 */
const AMBIGUOUS_KINDS = new Set(["route_inbound", "update_lead", "handoff_to_sales"]);

/** The action kinds the office itself knows about. */
const KNOWN_KINDS = new Set<string>(ACTION_KINDS);

/**
 * Action kinds whose output is about, or addressed to, an identifiable natural
 * person.
 *
 * Decided from the action kind alone, never from a company name: the same
 * legal entity may be a close corporation or a sole trader, and the office
 * cannot tell which from the name it was given.
 */
const PERSONAL_DATA_KINDS = new Set([
  "propose_close_lost",
  "escalate_account_risk",
  "cancel_subscription",
  "send_customer_mail",
  "draft_reply",
]);

/**
 * Payload keys that say the office already has a relationship with the
 * counterparty. A close of an existing relationship cannot be undone.
 */
const PRIOR_CONTACT_PAYLOAD_KEYS = [
  "priorContact",
  "existingCustomer",
  "customerSince",
  "priorEnquiry",
] as const;

/**
 * Payload keys that say the counterparty is new and the office has never
 * spoken to them. A close of a new relationship creates value rather than
 * ending something.
 */
const NEW_RELATIONSHIP_PAYLOAD_KEYS = ["newCustomer", "newLead", "noPriorContact"] as const;

/** What the payload says about the relationship behind a close. */
type RelationshipSignal = "new" | "existing" | "unknown";

function hasSignal(payload: Record<string, unknown> | undefined, keys: readonly string[]): boolean {
  if (!payload) return false;
  return keys.some((key) => {
    const value = payload[key];
    if (value === true) return true;
    if (typeof value === "number") return value > 0;
    if (typeof value === "string") return value.trim() !== "";
    return false;
  });
}

function relationshipSignal(payload: Record<string, unknown> | undefined): RelationshipSignal {
  if (!payload) return "unknown";
  if (hasSignal(payload, NEW_RELATIONSHIP_PAYLOAD_KEYS)) return "new";
  if (hasSignal(payload, PRIOR_CONTACT_PAYLOAD_KEYS)) return "existing";
  if (payload.noPriorContact === false) return "existing";
  return "unknown";
}

type TierDecision = {
  name: RiskTierName;
  rationale: string;
};

/**
 * Assign the tier to an action.
 *
 * The order of the tests is the order of consequence: the first rule that
 * matches decides the tier, so an action can never be talked down to a lower
 * tier by a later rule.
 */
function tierFor(
  kind: string,
  amountCents: number,
  payload: Record<string, unknown> | undefined,
): TierDecision {
  if (LEGAL_KINDS.has(kind)) {
    return {
      name: "1-Legal",
      rationale:
        "This decides something about a natural person, so POPIA section 71 may apply and a human must decide before it happens.",
    };
  }

  if (FINANCIAL_KINDS.has(kind)) {
    return {
      name: "1-Financial",
      rationale:
        "Money leaves the company here, so the founder must approve it before a penny moves.",
    };
  }

  if (kind === "issue_invoice" && amountCents >= HIGH_VALUE_CENTS) {
    return {
      name: "1-Financial",
      rationale: `This invoice of ${formatZar(amountCents)} is at or above the ${formatZar(
        HIGH_VALUE_CENTS,
      )} high-value line, so the founder must approve it.`,
    };
  }

  if (kind === "record_inbound_payment" && amountCents >= HIGH_VALUE_CENTS) {
    return {
      name: "2-Destructive",
      rationale: `Recording a payment of ${formatZar(
        amountCents,
      )} moves the books at the high-value line, so the founder must approve it.`,
    };
  }

  if (kind === "propose_close_won") {
    if (relationshipSignal(payload) === "new") {
      return {
        name: "3-Value",
        rationale:
          "This closes a new customer with no prior relationship to undo, so it creates value and the founder must approve it.",
      };
    }
    return {
      name: "2-Destructive",
      rationale:
        "This closes a customer, which ends a commercial relationship and cannot be undone cleanly, so the founder must approve it.",
    };
  }

  if (VALUE_KINDS.has(kind)) {
    return {
      name: "3-Value",
      rationale:
        "This puts a commercial offer or commitment in front of a customer, so the founder must approve it.",
    };
  }

  if (kind === "issue_invoice") {
    return {
      name: "3-Value",
      rationale: `This invoice of ${formatZar(
        amountCents,
      )} is below the ${formatZar(HIGH_VALUE_CENTS)} high-value line, but it still creates a payable, so the founder must approve it.`,
    };
  }

  if (kind === "record_inbound_payment") {
    return {
      name: "3-Value",
      rationale: `This payment of ${formatZar(
        amountCents,
      )} is below the ${formatZar(HIGH_VALUE_CENTS)} high-value line; it moves value in and creates a receipt, so the founder must approve it.`,
    };
  }

  if (AMBIGUOUS_KINDS.has(kind)) {
    return {
      name: "4-Ambiguous",
      rationale:
        "This needs judgement but moves nothing outside the office, so it may proceed without the founder.",
    };
  }

  if (!KNOWN_KINDS.has(kind)) {
    return {
      name: "5-Routine",
      rationale:
        "This is not an action kind the office knows, so it is treated as routine and the office may act on it alone.",
    };
  }

  return {
    name: "5-Routine",
    rationale:
      "This is ordinary work with no money, no customer and no commitment, so the office may act on it alone.",
  };
}

/**
 * Assess one action and say which tier it sits in, and why.
 *
 * The rationale is written for the founder: it names the reason in a sentence
 * rather than returning a number to be interpreted later.
 */
export function assessRisk(action: {
  kind: string;
  amountCents?: number;
  companyName?: string;
  payload?: Record<string, unknown>;
}): RiskAssessment {
  const kind = action.kind.trim().toLowerCase();
  const amountCents = Math.max(0, Math.round(action.amountCents ?? 0));
  const decision = tierFor(kind, amountCents, action.payload);
  const tier = TIER_OF_NAME[decision.name];

  return {
    tier,
    name: decision.name,
    rationale: decision.rationale,
    gated: GATED_TIERS.has(tier),
    personalData: decision.name === "1-Legal" || PERSONAL_DATA_KINDS.has(kind),
  };
}
