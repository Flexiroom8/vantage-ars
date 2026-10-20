import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GATE_QUESTIONS,
  MAX_REASONING_CHARS,
  MIN_REASONING_CHARS,
  REASON_CODES,
  requiresPreExposureReasoning,
  runGate71,
  validatePreExposureReasoning,
  type GateQuestion,
  type PreExposureReasoning,
} from "./gate71.ts";

/** A decision that passes every question. */
function allPass(overrides: Partial<Parameters<typeof runGate71>[0]> = {}) {
  return runGate71({
    significantEffect: true,
    humanJudgedFirst: true,
    profiling: false,
    purposeConsistent: true,
    explainable: true,
    ...overrides,
  });
}

function reasoning(overrides: Partial<PreExposureReasoning> = {}): PreExposureReasoning {
  return {
    reasonCode: "risk_confirmed",
    reasoning: "The founder reviewed the account and confirmed the risk on the record.",
    evidenceShown: "Account risk note, quote and invoice on file.",
    policyVersion: "policy-2026-01",
    ...overrides,
  };
}

describe("POPIA section 71 gate", () => {
  it("answers all five questions in order, even when Q1 fails", () => {
    const outcome = runGate71({
      significantEffect: false,
      humanJudgedFirst: false,
      profiling: true,
      purposeConsistent: false,
      explainable: false,
    });

    assert.equal(outcome.legal, false);
    assert.equal(outcome.failed, null);
    assert.equal(outcome.questions.length, 5);
    assert.deepEqual(
      outcome.questions.map((answer) => answer.question),
      GATE_QUESTIONS,
    );
    assert.equal(outcome.questions[0].passed, false);
    assert.equal(outcome.questions[1].passed, false);
    assert.equal(outcome.questions[2].passed, false);
    assert.equal(outcome.questions[3].passed, false);
    assert.equal(outcome.questions[4].passed, false);
  });

  it("keeps section 71 out of scope when there is no significant effect", () => {
    const outcome = runGate71({
      significantEffect: false,
      humanJudgedFirst: true,
      profiling: false,
      purposeConsistent: true,
      explainable: true,
    });

    assert.equal(outcome.legal, false);
    assert.equal(outcome.failed, null);
    assert.equal(requiresPreExposureReasoning(outcome), false);
    assert.ok(outcome.summary.includes("does not reach"));
  });

  it("reaches section 71 and names Q2 when no human judged first", () => {
    const outcome = allPass({ humanJudgedFirst: false });

    assert.equal(outcome.legal, true);
    assert.equal(outcome.failed, "q2_human_judged_first");
    assert.equal(requiresPreExposureReasoning(outcome), true);
  });

  it("reaches section 71 and names Q3 when the processing profiles a person", () => {
    const outcome = allPass({ profiling: true });

    assert.equal(outcome.legal, true);
    assert.equal(outcome.failed, "q3_profiling");
  });

  it("reaches section 71 and names Q4 when the purpose does not match", () => {
    const outcome = allPass({ purposeConsistent: false });

    assert.equal(outcome.legal, true);
    assert.equal(outcome.failed, "q4_purpose_consistent");
  });

  it("reaches section 71 and names Q5 when the decision cannot be explained", () => {
    const outcome = allPass({ explainable: false });

    assert.equal(outcome.legal, true);
    assert.equal(outcome.failed, "q5_explainable");
  });

  it("names the first failure in sequence order, not the last one seen", () => {
    const outcome = allPass({
      humanJudgedFirst: false,
      profiling: true,
      purposeConsistent: false,
      explainable: false,
    });

    assert.equal(outcome.legal, true);
    assert.equal(outcome.failed, "q2_human_judged_first");
    assert.equal(outcome.questions.filter((answer) => !answer.passed).length, 4);
  });

  it("passes cleanly when every question is answered yes", () => {
    const outcome = allPass();

    assert.equal(outcome.legal, true);
    assert.equal(outcome.failed, null);
    assert.equal(requiresPreExposureReasoning(outcome), true);
    assert.ok(outcome.questions.every((answer) => answer.passed));
  });

  it("gives every answer a plain detail line", () => {
    const outcome = allPass({ explainable: false });
    for (const answer of outcome.questions) {
      assert.ok(answer.detail.length > 0, `${answer.question} has no detail`);
      assert.ok(answer.detail.endsWith("."), `${answer.question} detail is not a sentence`);
    }
  });

  it("keeps the reason-code taxonomy fixed and complete", () => {
    const codes = REASON_CODES.map((entry) => entry.code);
    for (const required of [
      "risk_confirmed",
      "risk_dismissed",
      "customer_requested",
      "commercial_terms_agreed",
      "duplicate_record",
      "data_correction",
      "no_action_required",
      "escalated_to_human",
    ]) {
      assert.ok(codes.includes(required), `${required} is missing from the taxonomy`);
    }
    assert.equal(new Set(codes).size, codes.length);
    for (const entry of REASON_CODES) {
      assert.ok(entry.label.length > 0, `${entry.code} has no label`);
    }
  });

  it("accepts a well-formed pre-exposure record", () => {
    assert.deepEqual(validatePreExposureReasoning(reasoning()), { ok: true });
  });

  it("rejects an unknown reason code", () => {
    const result = validatePreExposureReasoning(reasoning({ reasonCode: "because_i_said_so" }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.error.includes("because_i_said_so"));
      assert.ok(result.error.includes("not a known reason code"));
    }
  });

  it("rejects reasoning that is too short to be understood later", () => {
    const result = validatePreExposureReasoning(reasoning({ reasoning: "too short" }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.error.includes(String(MIN_REASONING_CHARS)));
  });

  it("accepts reasoning of exactly the minimum length", () => {
    const exact = "x".repeat(MIN_REASONING_CHARS);
    assert.deepEqual(validatePreExposureReasoning(reasoning({ reasoning: exact })), { ok: true });
  });

  it("rejects reasoning that is too long to be read", () => {
    const result = validatePreExposureReasoning(
      reasoning({ reasoning: "x".repeat(MAX_REASONING_CHARS + 1) }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.error.includes(String(MAX_REASONING_CHARS)));
  });

  it("accepts reasoning of exactly the maximum length", () => {
    const exact = "x".repeat(MAX_REASONING_CHARS);
    assert.deepEqual(validatePreExposureReasoning(reasoning({ reasoning: exact })), { ok: true });
  });

  it("rejects an empty evidence line", () => {
    const result = validatePreExposureReasoning(reasoning({ evidenceShown: "" }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.error.includes("evidence"));
  });

  it("rejects an empty policy version", () => {
    const result = validatePreExposureReasoning(reasoning({ policyVersion: "" }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.error.includes("policy version"));
  });

  it("rejects fields that are not text", () => {
    const broken = [
      { reasonCode: 7 },
      { reasoning: null },
      { evidenceShown: undefined },
      { policyVersion: { version: "2026-01" } },
    ];

    for (const patch of broken) {
      const result = validatePreExposureReasoning(
        reasoning(patch as unknown as Partial<PreExposureReasoning>),
      );
      assert.equal(result.ok, false, `${JSON.stringify(patch)} was accepted`);
      if (!result.ok) assert.ok(result.error.length > 0);
    }
  });

  it("lists the questions in the order the regulator reads them", () => {
    assert.deepEqual(GATE_QUESTIONS, [
      "q1_significant_effect",
      "q2_human_judged_first",
      "q3_profiling",
      "q4_purpose_consistent",
      "q5_explainable",
    ] as GateQuestion[]);
  });
});
