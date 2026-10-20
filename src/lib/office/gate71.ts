/**
 * The POPIA section 71 gate.
 *
 * Section 71 of POPIA prohibits a decision with legal or similarly significant
 * effect on a person where the decision is based solely on automated
 * processing and that processing is intended to profile a person. The office
 * runs on exactly that kind of processing — rules, thresholds, drafts — so
 * the question is not whether the office ever touches section 71, but whether
 * it can show, for any particular decision, that a human was genuinely in
 * the loop before the machine's proposal was seen.
 *
 * This module implements the five-question test in the order the regulator
 * reads it:
 *
 *   Q1  does the output decide something with legal or similarly significant
 *       effect? If not, section 71 does not reach the decision at all.
 *   Q2  did a human form a judgment BEFORE seeing the machine's proposal?
 *   Q3  is the processing intended to build a profile of a person?
 *   Q4  was the personal information collected for this purpose?
 *   Q5  can the system explain this specific decision?
 *
 * The test is sequenced, not a checklist. Q1 is asked first because a
 * decision with no significant effect is out of scope whatever the answers
 * to Q2 to Q5 are — but all five are still answered and kept for the record,
 * because a founder asking "why did the office stop and ask me?" deserves a
 * complete answer, not a partial one.
 *
 * What it deliberately does not do:
 *   - it does not decide whether an action is permitted. It reports whether
 *     the decision is section-71-reachable and therefore must carry a human
 *     decision; the governor decides what happens next;
 *   - it does not assess the quality of a human's judgment, only whether a
 *     judgment existed and came first;
 *   - it does not invent reason codes. The taxonomy below is fixed, because a
 *     governance record whose vocabulary can grow at runtime cannot be
 *     audited across years;
 *   - it does not read the clock, the database, or the environment, and it
 *     calls nothing.
 *
 * Pure module: no database, no clock, no environment. Unit tested directly.
 */

export type GateQuestion =
  | "q1_significant_effect"
  | "q2_human_judged_first"
  | "q3_profiling"
  | "q4_purpose_consistent"
  | "q5_explainable";

export type GateAnswer = {
  question: GateQuestion;
  passed: boolean;
  detail: string;
};

export type GateOutcome = {
  /** True when the decision is §71-reachable and must carry a human decision. */
  legal: boolean;
  questions: GateAnswer[];
  /** The question that failed, if any. */
  failed: GateQuestion | null;
  summary: string;
};

/** The order the questions are asked in. */
export const GATE_QUESTIONS: readonly GateQuestion[] = [
  "q1_significant_effect",
  "q2_human_judged_first",
  "q3_profiling",
  "q4_purpose_consistent",
  "q5_explainable",
];

/** Plain words for each question, for the founder's screen. */
export const GATE_QUESTION_LABELS: Record<GateQuestion, string> = {
  q1_significant_effect: "whether the decision has a legal or similarly significant effect",
  q2_human_judged_first: "whether a human judged the case before seeing the machine's proposal",
  q3_profiling: "whether the processing is intended to profile a person",
  q4_purpose_consistent: "whether the personal information was collected for this purpose",
  q5_explainable: "whether the system can explain this specific decision",
};

/** The minimum length of a written reason, in characters. */
export const MIN_REASONING_CHARS = 20;

/** The maximum length of a written reason, in characters. */
export const MAX_REASONING_CHARS = 2000;

/**
 * The fixed reason-code taxonomy.
 *
 * Closed on purpose: the office must not invent a reason code at runtime, or
 * two years of records could not be counted against one another.
 */
export const REASON_CODES: { code: string; label: string }[] = [
  { code: "risk_confirmed", label: "The risk was confirmed." },
  { code: "risk_dismissed", label: "The risk was dismissed." },
  { code: "customer_requested", label: "The customer asked for this." },
  { code: "commercial_terms_agreed", label: "Commercial terms were agreed with the customer." },
  { code: "duplicate_record", label: "This is a duplicate of a record already on file." },
  { code: "data_correction", label: "This corrects a mistake in the personal information." },
  { code: "no_action_required", label: "No action is required." },
  { code: "escalated_to_human", label: "The decision was escalated to a human." },
];

function isKnownReasonCode(code: string): boolean {
  return REASON_CODES.some((entry) => entry.code === code);
}

/**
 * Run the section 71 test.
 *
 * All five questions are always answered and always returned in order. If Q1
 * fails the decision is out of scope and `failed` stays null — there is no
 * failing gate question, because there is no legal exposure to fail.
 */
export function runGate71(input: {
  /** Does the output decide something with legal or similarly significant effect? */
  significantEffect: boolean;
  /** Did a human form a judgment BEFORE seeing the machine's proposal? */
  humanJudgedFirst: boolean;
  /** Is the processing intended to build a profile of a person? */
  profiling: boolean;
  /** Was the personal information collected for this purpose? */
  purposeConsistent: boolean;
  /** Can the system explain this specific decision? */
  explainable: boolean;
}): GateOutcome {
  const questions: GateAnswer[] = [
    {
      question: "q1_significant_effect",
      passed: input.significantEffect === true,
      detail:
        input.significantEffect === true
          ? "The output decides something with legal or similarly significant effect."
          : "The output has no legal or similarly significant effect.",
    },
    {
      question: "q2_human_judged_first",
      passed: input.humanJudgedFirst === true,
      detail:
        input.humanJudgedFirst === true
          ? "A human formed a judgment before the machine's proposal was seen."
          : "No human judgment was formed before the machine's proposal was seen.",
    },
    {
      question: "q3_profiling",
      passed: input.profiling !== true,
      detail:
        input.profiling !== true
          ? "The processing is not intended to build a profile of a person."
          : "The processing is intended to build a profile of a person.",
    },
    {
      question: "q4_purpose_consistent",
      passed: input.purposeConsistent === true,
      detail:
        input.purposeConsistent === true
          ? "The personal information was collected for this purpose."
          : "The personal information was not collected for this purpose.",
    },
    {
      question: "q5_explainable",
      passed: input.explainable === true,
      detail:
        input.explainable === true
          ? "The system can explain this specific decision."
          : "The system cannot explain this specific decision.",
    },
  ];

  const q1Passed = questions[0].passed;

  if (!q1Passed) {
    return {
      legal: false,
      questions,
      failed: null,
      summary:
        "POPIA section 71 does not reach this decision: it has no legal or similarly significant effect, so no human decision is needed on section 71 grounds.",
    };
  }

  const firstFailure = questions.find((answer) => !answer.passed) ?? null;

  if (!firstFailure) {
    return {
      legal: true,
      questions,
      failed: null,
      summary:
        "POPIA section 71 reaches this decision and every test passed: a human judged first, no profiling, a consistent purpose, and an explainable decision.",
    };
  }

  return {
    legal: true,
    questions,
    failed: firstFailure.question,
    summary: `POPIA section 71 reaches this decision. The first failing test is ${
      GATE_QUESTION_LABELS[firstFailure.question]
    }: ${firstFailure.detail} A human decision is required before this touches the outside world.`,
  };
}

/**
 * Whether this outcome obliges the office to record its reasoning before the
 * action is exposed to the outside world.
 *
 * Exactly the same thing as "the decision is section-71-reachable", spelled
 * out so the call site reads as a rule rather than as law.
 */
export function requiresPreExposureReasoning(gate: GateOutcome): boolean {
  return gate.legal === true;
}

export type PreExposureReasoning = {
  reasonCode: string;
  reasoning: string;
  evidenceShown: string;
  policyVersion: string;
};

/**
 * Validate the record of a human decision before the action is exposed.
 *
 * The errors are plain sentences because they are shown to the founder, not
 * to a machine: "The reasoning is shorter than 20 characters" is something a
 * person can act on.
 */
export function validatePreExposureReasoning(value: PreExposureReasoning):
  | {
      ok: true;
    }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object") {
    return {
      ok: false,
      error: "The pre-exposure reasoning must be a record with four text fields.",
    };
  }

  if (typeof value.reasonCode !== "string") {
    return { ok: false, error: "The reason code must be text." };
  }
  if (typeof value.reasoning !== "string") {
    return { ok: false, error: "The reasoning must be text." };
  }
  if (typeof value.evidenceShown !== "string") {
    return { ok: false, error: "The evidence shown must be text." };
  }
  if (typeof value.policyVersion !== "string") {
    return { ok: false, error: "The policy version must be text." };
  }

  const reasonCode = value.reasonCode.trim();
  if (reasonCode === "") {
    return { ok: false, error: "The reason code must not be empty." };
  }
  if (!isKnownReasonCode(reasonCode)) {
    return {
      ok: false,
      error: `"${reasonCode}" is not a known reason code. Use one of the fixed codes: ${REASON_CODES.map(
        (entry) => entry.code,
      ).join(", ")}.`,
    };
  }

  const reasoningLength = value.reasoning.trim().length;
  if (reasoningLength < MIN_REASONING_CHARS) {
    return {
      ok: false,
      error: `The reasoning must be at least ${MIN_REASONING_CHARS} characters so it can be understood later.`,
    };
  }
  if (reasoningLength > MAX_REASONING_CHARS) {
    return {
      ok: false,
      error: `The reasoning must be ${MAX_REASONING_CHARS} characters or fewer.`,
    };
  }

  if (value.evidenceShown.trim() === "") {
    return { ok: false, error: "The evidence shown must not be empty." };
  }

  if (value.policyVersion.trim() === "") {
    return { ok: false, error: "The policy version must not be empty." };
  }

  return { ok: true };
}
