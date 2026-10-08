import { PROVISIONS } from "./data";
import type {
  ActionType,
  AgentId,
  ConstraintEval,
  DecisionStatus,
  GovernorVerdict,
  ProvisionId,
  Reversibility,
  Strategy,
} from "./types";

export interface FiduciaryLimits {
  maxSingle: number;
  maxDaily: number;
}

export interface Proposal {
  agentId: AgentId;
  type: ActionType;
  title: string;
  summary: string;
  counterparty: string;
  value: number;
  confidence: number;
  injectionScore: number;
  provisions: ProvisionId[];
  strategies: Strategy[];
  reversibility: Reversibility;
  rationale: string;
  forcedVerdict?: GovernorVerdict;
  forcedReason?: string;
}

export interface Authorization {
  verdict: GovernorVerdict;
  status: DecisionStatus;
  reason: string;
  constraints: ConstraintEval[];
  latencyMs: number;
}

function numParam(id: ProvisionId, key: string, fallback: number): number {
  const p = PROVISIONS.find((x) => x.id === id);
  const v = p?.parameters?.[key];
  return typeof v === "number" ? v : fallback;
}

export function currentLimits(overrides?: Partial<FiduciaryLimits>): FiduciaryLimits {
  return {
    maxSingle: overrides?.maxSingle ?? numParam("ART-2", "max_single_transaction", 1_000_000),
    maxDaily: overrides?.maxDaily ?? numParam("ART-2", "max_daily_exposure", 10_000_000),
  };
}

export function authorize(
  proposal: Proposal,
  spentToday: number,
  limits: FiduciaryLimits,
): Authorization {
  const t0 = 8 + Math.round(proposal.confidence * 40);
  const constraints: ConstraintEval[] = [];

  if (proposal.forcedVerdict === "DENY") {
    return {
      verdict: "DENY",
      status: "blocked",
      reason: proposal.forcedReason ?? "Forced deny.",
      constraints,
      latencyMs: t0,
    };
  }

  if (proposal.injectionScore > 0.8) {
    constraints.push({
      provision: "ART-1",
      check: "input_sanitization",
      limit: "0.80",
      actual: proposal.injectionScore.toFixed(2),
      margin: 0,
      passed: false,
    });
    return {
      verdict: "DENY",
      status: "blocked",
      reason: `Adversarial input. Injection score ${proposal.injectionScore.toFixed(2)}. Default deny.`,
      constraints,
      latencyMs: t0,
    };
  }

  if (proposal.value > 0) {
    const marginSingle = (limits.maxSingle - proposal.value) / limits.maxSingle;
    const passedSingle = proposal.value <= limits.maxSingle;
    constraints.push({
      provision: "ART-2",
      check: "max_single_transaction",
      limit: String(limits.maxSingle),
      actual: String(proposal.value),
      margin: Math.max(0, marginSingle),
      passed: passedSingle,
    });
    if (!passedSingle) {
      return {
        verdict: "DENY",
        status: "blocked",
        reason: `ART-2 fiduciary hard block. ${proposal.value} exceeds single-tx cap ${limits.maxSingle}.`,
        constraints,
        latencyMs: t0,
      };
    }

    const nextSpend = spentToday + proposal.value;
    const marginDaily = (limits.maxDaily - nextSpend) / limits.maxDaily;
    const passedDaily = nextSpend <= limits.maxDaily;
    constraints.push({
      provision: "ART-2",
      check: "max_daily_exposure",
      limit: String(limits.maxDaily),
      actual: String(nextSpend),
      margin: Math.max(0, marginDaily),
      passed: passedDaily,
    });
    if (!passedDaily) {
      return {
        verdict: "DENY",
        status: "blocked",
        reason: `ART-2 daily exposure would be ${nextSpend} against cap ${limits.maxDaily}.`,
        constraints,
        latencyMs: t0,
      };
    }

    if (marginSingle < 0.05 || marginDaily < 0.05) {
      return {
        verdict: "REVIEW",
        status: "escalated",
        reason: "ART-9 critical margin. Halt-and-notify. Action not executed.",
        constraints,
        latencyMs: t0 + 12,
      };
    }

    if (marginSingle < 0.2 || marginDaily < 0.2) {
      return {
        verdict: "REVIEW",
        status: "review",
        reason: "ART-9 warning band. log_and_continue with throttle.",
        constraints,
        latencyMs: t0 + 8,
      };
    }
  }

  if (proposal.confidence < 0.5) {
    return {
      verdict: "DENY",
      status: "escalated",
      reason: `ART-9 confidence ${proposal.confidence.toFixed(2)} below critical 0.50. Halt-and-notify.`,
      constraints,
      latencyMs: t0,
    };
  }

  if (proposal.confidence < 0.7) {
    return {
      verdict: "REVIEW",
      status: "review",
      reason: `ART-9 confidence ${proposal.confidence.toFixed(2)} below warning 0.70. log_and_continue.`,
      constraints,
      latencyMs: t0 + 6,
    };
  }

  constraints.push({
    provision: "ART-5",
    check: "audit_completeness",
    limit: "complete_record",
    actual: "complete_record",
    margin: 1,
    passed: true,
  });

  return {
    verdict: "ALLOW",
    status: "authorized",
    reason: "Evidence package valid. Policy version 1.0.0. Precedence: allow.",
    constraints,
    latencyMs: t0 + Math.round(proposal.value > 0 ? 40 : 12),
  };
}
