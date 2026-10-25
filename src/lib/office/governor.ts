import { AGENT_BY_ID } from "./agents.ts";
import { priceQuote } from "./quote.ts";
import { isAutonomouslyDeliverable, planForRate } from "./plans.ts";
import {
  DELEGATABLE_ACTIONS,
  evaluateDelegation,
  type DelegationAction,
  type DelegationPolicy,
} from "./delegation.ts";
import type {
  ActionKind,
  ApprovalKind,
  AuthorizationDecision,
  CompanySnapshot,
  GovernorVerdict,
  ProposedAction,
  ProvisionCheck,
  Reversibility,
} from "./types.ts";

const WIN_KINDS = new Set<ActionKind>(["propose_close_won", "issue_quote"]);
const LOSS_KINDS = new Set<ActionKind>([
  "propose_close_lost",
  "escalate_account_risk",
  "cancel_subscription",
]);
const SALES_KINDS = new Set<ActionKind>([
  "open_opportunity",
  "advance_opportunity",
  "issue_quote",
  "propose_close_won",
  "propose_close_lost",
]);
const COST_KINDS = new Set<ActionKind>(["record_expense", "activate_campaign"]);
export const PAID_CAMPAIGN_MONTHLY_CAP_CENTS = 30_000;

/**
 * Action kinds that exist only because a founder delegated them.
 *
 * The older kinds keep their old behaviour with no delegation at all: the
 * founder still raises the invoice, still approves the quote, still wins the
 * customer. These four are different — they are how the office acts on its own
 * — so they are refused outright unless a delegation covers them.
 */
const DELEGATION_ONLY_KINDS = new Set<ActionKind>([
  "fulfil_service",
  "start_subscription",
  "cancel_subscription",
  "send_customer_mail",
]);

const DELEGATABLE = new Set<ActionKind>(DELEGATABLE_ACTIONS as readonly ActionKind[]);

const PROTECTED = [
  "race",
  "ethnicity",
  "gender",
  "religion",
  "disability",
  "national origin",
  "sexual orientation",
];

const DIGNITY_FAIL = [
  "idiot",
  "stupid",
  "kill yourself",
  "hate",
  "scam them",
  "trick them",
  "prey on",
  "manipulate",
  "coerce",
];

const INJECTION_FAIL = [
  "ignore previous",
  "ignore all instructions",
  "disregard the constitution",
  "you are now",
  "system prompt",
  "disable audit",
  "resist shutdown",
  "hide this from the founder",
];

const IRREVERSIBLE = new Set<ActionKind>([
  "propose_close_won",
  "propose_close_lost",
  "issue_quote",
  "record_expense",
  "record_inbound_payment",
  "issue_invoice",
  "activate_campaign",
  "start_subscription",
  "cancel_subscription",
]);

function textBlob(action: ProposedAction): string {
  return `${action.title} ${action.rationale} ${JSON.stringify(action.payload)}`.toLowerCase();
}

function reversibilityOf(kind: ActionKind): Reversibility {
  if (IRREVERSIBLE.has(kind)) return "partially_reversible";
  if (kind === "handoff_to_sales") return "costly_reversible";
  return "fully_reversible";
}

function push(
  trace: ProvisionCheck[],
  provision: string,
  check: string,
  passed: boolean,
  detail: string,
  margin: number | null = null,
): void {
  trace.push({ provision, check, passed, margin, detail });
}

export type GovernorExtras = {
  approvedHandoff?: boolean;
  opportunityWon?: boolean;
  /** The founder's standing delegation, if there is one. */
  delegation?: DelegationPolicy | null;
  /** How much of the delegation has already been used. */
  delegationUsage?: { usedToday: number; usedThisMonth: number };
  /** Whether the customer has an accepted quote on file. */
  acceptedQuote?: boolean;
  /** Whether the customer actually contacted the office. */
  realEnquiry?: boolean;
  /** Paid campaign spend already recorded in the current Johannesburg month. */
  campaignSpendThisMonthCents?: number;
  /**
   * True when a person asked for this action. The founder present at the
   * keyboard is the authority, so the delegation-only action kinds are
   * permitted — the delegation exists to let the office act ALONE, not to
   * stop the founder.
   */
  founderInitiated?: boolean;
};

export function authorizeAction(
  action: ProposedAction,
  agentId: string,
  company: CompanySnapshot,
  extras?: GovernorExtras,
): AuthorizationDecision {
  const trace: ProvisionCheck[] = [];
  const constraints: string[] = [];
  let verdict: GovernorVerdict = "allow";
  let reason = "Within constitutional envelope.";
  let approvalKind: ApprovalKind | null = null;
  let delegation: AuthorizationDecision["delegation"] = null;

  const agent = AGENT_BY_ID[agentId];
  if (!agent) {
    return {
      verdict: "deny",
      reason: "Unknown non-human identity.",
      approvalKind: null,
      reversibility: reversibilityOf(action.kind),
      trace: [
        { provision: "ART-10", check: "known_nhi", passed: false, margin: null, detail: agentId },
      ],
      runtimeConstraints: [],
      delegation: null,
    };
  }

  if (company.halted) {
    push(trace, "ART-10", "halt_honoured", false, company.haltReason ?? "Office is halted.");
    return {
      verdict: "deny",
      reason: "Office is halted. Agents may not act until the founder resumes operations.",
      approvalKind: null,
      reversibility: reversibilityOf(action.kind),
      trace,
      runtimeConstraints: ["halted"],
      delegation: null,
    };
  }

  const blob = textBlob(action);
  const confidence = clamp(action.confidence, 0, 1);
  const amount = Math.max(0, Math.round(action.amountCents || 0));

  if (action.kind === "activate_campaign" && amount > 0) {
    const spent = Math.max(0, Math.round(extras?.campaignSpendThisMonthCents ?? 0));
    const withinCap = spent + amount <= PAID_CAMPAIGN_MONTHLY_CAP_CENTS;
    push(
      trace,
      "ART-2",
      "monthly_marketing_cap",
      withinCap,
      withinCap
        ? `Requested ${amount} cents with ${spent} cents already spent; monthly cap is ${PAID_CAMPAIGN_MONTHLY_CAP_CENTS} cents.`
        : `Requested spend would exceed the R300 monthly paid-campaign cap (${spent} already spent).`,
      PAID_CAMPAIGN_MONTHLY_CAP_CENTS - spent - amount,
    );
    if (!withinCap) {
      return {
        verdict: "deny",
        reason: "Blocked: paid campaign spend exceeds the R300 monthly cap.",
        approvalKind: null,
        reversibility: reversibilityOf(action.kind),
        trace,
        runtimeConstraints: ["monthly_marketing_cap"],
        delegation: null,
      };
    }
  }

  if (!extras?.founderInitiated) {
    const rateId = typeof action.payload.rateId === "string" ? action.payload.rateId : "";
    const planId =
      action.kind === "issue_quote" && planForRate(rateId)
        ? rateId
        : typeof action.payload.planId === "string"
          ? action.payload.planId
          : "";
    const requiresAutonomousDelivery =
      action.kind === "start_subscription" ||
      action.kind === "fulfil_service" ||
      (action.kind === "issue_invoice" && Boolean(action.payload.cycleId));
    const planIsNotAutonomous =
      planId.length > 0 &&
      ((action.kind === "issue_quote" && !isAutonomouslyDeliverable(planId)) ||
        (action.kind !== "issue_quote" &&
          requiresAutonomousDelivery &&
          !isAutonomouslyDeliverable(planId)));
    if (requiresAutonomousDelivery && (!planId || planIsNotAutonomous)) {
      push(
        trace,
        "ART-13",
        "autonomous_delivery_capability",
        false,
        planId
          ? `The ${planId} plan includes work the office cannot deliver unattended.`
          : "No autonomously deliverable plan was identified for this action.",
      );
      return {
        verdict: "deny",
        reason:
          "Blocked: this plan requires human delivery and cannot be sold, billed, or fulfilled unattended.",
        approvalKind: null,
        reversibility: reversibilityOf(action.kind),
        trace,
        runtimeConstraints: ["human_delivery_required"],
        delegation: null,
      };
    }
    if (action.kind === "issue_quote" && planId && planIsNotAutonomous) {
      push(
        trace,
        "ART-13",
        "autonomous_delivery_capability",
        false,
        `The ${planId} plan includes work the office cannot deliver unattended.`,
      );
      return {
        verdict: "deny",
        reason: "Blocked: this plan requires human delivery and cannot be quoted unattended.",
        approvalKind: null,
        reversibility: reversibilityOf(action.kind),
        trace,
        runtimeConstraints: ["human_delivery_required"],
        delegation: null,
      };
    }
  }

  if (!agent.allowedActions.includes(action.kind)) {
    push(
      trace,
      "ART-11",
      "role_separation",
      false,
      `${agent.callsign} is not authorised to ${action.kind}.`,
    );
    verdict = "deny";
    reason = `${agent.title} cannot perform ${action.kind}. Role separation is a hard block.`;
  } else {
    push(trace, "ART-11", "role_separation", true, `${agent.callsign} may ${action.kind}.`);
  }

  if (INJECTION_FAIL.some((p) => blob.includes(p))) {
    push(
      trace,
      "ART-10",
      "instruction_override",
      false,
      "Adversarial instruction pattern in the proposal.",
    );
    verdict = "deny";
    reason = "Blocked: instruction-override or shutdown-resistance pattern.";
  } else {
    push(
      trace,
      "ART-10",
      "instruction_override",
      true,
      "No shutdown resistance or override pattern.",
    );
  }

  if (DIGNITY_FAIL.some((p) => blob.includes(p))) {
    push(
      trace,
      "ART-7",
      "human_dignity",
      false,
      "Proposal contains coercive or degrading language.",
    );
    verdict = "deny";
    reason = "Blocked: human dignity constraint.";
  } else {
    push(trace, "ART-7", "human_dignity", true, "Language within dignity bounds.");
  }

  const usesProtected = PROTECTED.some(
    (p) => blob.includes(p) && /because|based on|due to/.test(blob),
  );
  if (usesProtected) {
    push(
      trace,
      "ART-3",
      "non_discrimination",
      false,
      "Protected characteristic used as a decision factor.",
    );
    verdict = "deny";
    reason = "Blocked: non-discrimination constraint.";
  } else {
    push(
      trace,
      "ART-3",
      "non_discrimination",
      true,
      "No protected-characteristic decisioning detected.",
    );
  }

  if (SALES_KINDS.has(action.kind) && agent.id !== "close") {
    push(trace, "ART-11", "sales_boundary", false, "Only Sales may run pipeline actions.");
    verdict = "deny";
    reason = "Marketing and other departments stop at the sales boundary.";
  }

  // ── Delegated authority (ART-13) ──────────────────────────────────────────
  // Evaluated after the absolute blocks, so a delegation can never rescue an
  // action that was already refused for role, dignity, injection or
  // discrimination reasons.
  const delegationPolicy = extras?.delegation ?? null;
  let delegationAllowed = false;

  if (DELEGATABLE.has(action.kind)) {
    const rateId =
      typeof action.payload.rateId === "string" && action.payload.rateId.trim()
        ? action.payload.rateId.trim()
        : null;
    const outcome = evaluateDelegation(delegationPolicy, {
      action: action.kind as DelegationAction,
      amountCents: amount,
      rateId,
      acceptedQuote: extras?.acceptedQuote === true,
      opportunityWon: extras?.opportunityWon === true,
      realEnquiry: extras?.realEnquiry === true,
      usedToday: extras?.delegationUsage?.usedToday ?? 0,
      usedThisMonth: extras?.delegationUsage?.usedThisMonth ?? 0,
    });
    delegationAllowed = outcome.allowed;
    push(trace, "ART-13", "delegated_authority", outcome.allowed, outcome.reason);
    if (outcome.allowed) {
      delegation = {
        id: delegationPolicy?.id ?? "",
        label: delegationPolicy?.label ?? "",
        check: outcome.check,
      };
    } else if (DELEGATION_ONLY_KINDS.has(action.kind) && !extras?.founderInitiated) {
      // These actions exist only under a delegation. Without one they are not
      // "escalated" — they are simply not permitted. A founder who asked for
      // the action directly is the authority and is not blocked.
      push(trace, "ART-13", "delegation_required", false, outcome.reason);
      if (verdict !== "deny") {
        verdict = "deny";
        reason = `Blocked: ${action.kind} needs a standing founder delegation. ${outcome.reason}`;
      }
    }
  }

  if (
    (action.kind === "open_opportunity" || action.kind === "issue_quote") &&
    !extras?.approvedHandoff &&
    !delegationAllowed
  ) {
    push(
      trace,
      "ART-12",
      "handoff_gate",
      false,
      "No approved marketing-to-sales handoff for this company.",
    );
    if (verdict !== "deny") {
      verdict = "deny";
      reason = "Sales cannot open work without an approved handoff.";
    }
  } else if (action.kind === "open_opportunity" || action.kind === "issue_quote") {
    push(
      trace,
      "ART-12",
      "handoff_gate",
      true,
      delegationAllowed
        ? "Delegated sales authority (ART-13) stands in for the handoff."
        : "Approved handoff present.",
    );
  }

  if (action.kind === "issue_quote") {
    const location = action.payload.location === "onsite" ? "onsite" : "remote";
    const priced = priceQuote({
      rateId: String(action.payload.rateId ?? ""),
      location,
      quantity: Number(action.payload.quantity),
    });
    const matches = priced.ok && priced.cents === amount;
    push(
      trace,
      "ART-4",
      "published_price",
      matches,
      matches
        ? priced.detail
        : priced.ok
          ? "Amount does not match the published rate."
          : priced.error,
    );
    if (!matches && verdict !== "deny") {
      verdict = "deny";
      reason = priced.ok ? "Quote amount does not match the published rate." : priced.error;
    }
  }

  if (action.kind === "issue_invoice" && !extras?.opportunityWon && !delegationAllowed) {
    push(
      trace,
      "ART-12",
      "invoice_gate",
      false,
      "Invoice without a won opportunity is a customer-win event.",
    );
    if (verdict !== "deny") {
      verdict = "review";
      approvalKind = "customer_win";
      reason = "Issuing an invoice without a closed win needs founder approval.";
    }
  } else if (action.kind === "issue_invoice") {
    push(
      trace,
      "ART-12",
      "invoice_gate",
      true,
      delegationAllowed
        ? "Delegated billing authority (ART-13) authorises this invoice."
        : "Won opportunity on file. Invoice is operational.",
    );
  }

  const isCost = COST_KINDS.has(action.kind) && amount > 0;
  if (isCost) {
    const cash = company.treasuryCents;
    const margin = cash <= 0 ? 0 : Math.max(0, 1 - amount / Math.max(cash, 1));
    push(
      trace,
      "ART-2",
      "fiduciary_spend",
      amount <= cash,
      `Requested ${amount} cents against treasury ${cash} cents.`,
      margin,
    );
    push(trace, "ART-12", "cost_gate", false, "Any cost requires founder approval.");
    if (verdict !== "deny") {
      verdict = "review";
      approvalKind = "cost";
      reason =
        amount > cash
          ? "This action costs money and exceeds treasury. Founder may accrue it as a payable."
          : "This action costs money. Founder approval is required.";
    }
    if (amount > cash) constraints.push("insufficient_treasury");
  } else {
    push(trace, "ART-2", "fiduciary_spend", true, "No cash outflow proposed.", 1);
  }

  if (action.kind === "handoff_to_sales") {
    push(trace, "ART-12", "sales_handoff", false, "Marketing-to-sales handoff is a founder gate.");
    if (verdict !== "deny") {
      verdict = "review";
      approvalKind = "sales_handoff";
      reason = "Marketing ends here. Founder must move this into Sales.";
    }
  }

  if (WIN_KINDS.has(action.kind) && !delegationAllowed) {
    push(trace, "ART-12", "customer_win", false, "Winning a customer requires founder approval.");
    if (verdict !== "deny") {
      verdict = "review";
      approvalKind = "customer_win";
      reason = "This action risks winning a customer. Founder approval is required.";
    }
  } else if (WIN_KINDS.has(action.kind)) {
    push(
      trace,
      "ART-12",
      "customer_win",
      true,
      "Delegated authority (ART-13) pre-approves this class of win.",
    );
  }

  if (LOSS_KINDS.has(action.kind) && !delegationAllowed) {
    push(trace, "ART-12", "customer_loss", false, "Losing a customer requires founder approval.");
    if (verdict !== "deny") {
      verdict = "review";
      approvalKind = "customer_loss";
      reason = "This action risks losing a customer. Founder approval is required.";
    }
  } else if (LOSS_KINDS.has(action.kind)) {
    push(
      trace,
      "ART-12",
      "customer_loss",
      true,
      "Delegated authority (ART-13) pre-approves this class of loss.",
    );
  }

  if (confidence < 0.5) {
    push(
      trace,
      "ART-9",
      "confidence_critical",
      false,
      `Confidence ${confidence.toFixed(2)} < 0.50.`,
      confidence,
    );
    if (verdict !== "deny") {
      verdict = "review";
      approvalKind = approvalKind ?? "constraint_margin";
      reason = "Confidence is below the critical threshold. Escalating.";
    }
  } else if (confidence < 0.7) {
    push(
      trace,
      "ART-9",
      "confidence_warning",
      true,
      `Confidence ${confidence.toFixed(2)} in warning band.`,
      confidence,
    );
    constraints.push("log_and_continue");
  } else {
    push(trace, "ART-9", "confidence", true, `Confidence ${confidence.toFixed(2)}.`, confidence);
  }

  push(trace, "ART-1", "jurisdiction", true, "Action evaluated under ZA law and POPIA.");
  push(trace, "ART-4", "truthfulness", true, "Proposal bound to office records at execution.");
  push(trace, "ART-5", "audit", true, "Decision will be hash-chained.");
  push(trace, "ART-8", "carbon", true, "Single bounded evaluation, no retry storm.");

  if (verdict === "deny") {
    return {
      verdict,
      reason,
      approvalKind: null,
      reversibility: reversibilityOf(action.kind),
      trace,
      runtimeConstraints: constraints,
      delegation: null,
    };
  }

  return {
    verdict,
    reason,
    approvalKind,
    reversibility: reversibilityOf(action.kind),
    trace,
    runtimeConstraints: constraints,
    delegation,
  };
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}
