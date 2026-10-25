import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { servicePage } from "./services.ts";
import {
  ASSESSMENT_QUESTIONS,
  assessReadiness,
  createReadinessEnquiryDraft,
  type AssessmentAnswers,
  type AssessmentAnswer,
} from "./assessment.ts";

describe("public IT readiness assessment", () => {
  it("requires an answer for each question before producing a result", () => {
    assert.equal(assessReadiness({}), null);
    assert.equal(
      assessReadiness(
        Object.fromEntries(
          ASSESSMENT_QUESTIONS.slice(1).map((question) => [question.id, "yes"]),
        ) as AssessmentAnswers,
      ),
      null,
    );
  });

  it("scores only answers the visitor can assess and reports unknowns separately", () => {
    const answers = Object.fromEntries(
      ASSESSMENT_QUESTIONS.map((question, index) => [
        question.id,
        index === 0 ? "unknown" : index < 4 ? "no" : "yes",
      ]),
    ) as AssessmentAnswers;
    const result = assessReadiness(answers);

    assert.ok(result);
    assert.equal(result.score, 50);
    assert.equal(result.reviewed, 6);
    assert.equal(result.unverified, 1);
    assert.equal(result.label, "Practices developing");
    assert.equal(result.findings[0]?.status, "verify");
  });

  it("does not assign a score when every answer is unknown", () => {
    const answers = Object.fromEntries(
      ASSESSMENT_QUESTIONS.map((question) => [question.id, "unknown"]),
    ) as AssessmentAnswers;
    const result = assessReadiness(answers);

    assert.ok(result);
    assert.equal(result.score, null);
    assert.equal(result.label, "Not enough information");
    assert.equal(result.priorities.length <= 3, true);
    assert.equal(
      result.findings.every((finding) => finding.status === "verify"),
      true,
    );
  });

  it("ranks improvement actions and points only to published service pages", () => {
    const answers = Object.fromEntries(
      ASSESSMENT_QUESTIONS.map((question) => [question.id, "no" satisfies AssessmentAnswer]),
    ) as AssessmentAnswers;
    const result = assessReadiness(answers);

    assert.ok(result);
    assert.equal(result.score, 0);
    assert.equal(result.label, "Limited evidence");
    assert.equal(result.priorities.length <= 3, true);
    assert.equal(
      result.priorities.every((finding) => servicePage(finding.serviceSlug) !== undefined),
      true,
    );
  });

  it("recognizes consistently reviewed practices without calling them a certification", () => {
    const answers = Object.fromEntries(
      ASSESSMENT_QUESTIONS.map((question) => [question.id, "yes"]),
    ) as AssessmentAnswers;
    const result = assessReadiness(answers);

    assert.ok(result);
    assert.equal(result.score, 100);
    assert.equal(result.label, "Practices established");
    assert.equal(result.priorities.length, 0);
  });

  it("creates an explicit opt-in quote draft without overstating the self-assessment", () => {
    const answers = Object.fromEntries(
      ASSESSMENT_QUESTIONS.map((question) => [question.id, "no" satisfies AssessmentAnswer]),
    ) as AssessmentAnswers;
    const result = assessReadiness(answers);
    assert.ok(result);

    const draft = createReadinessEnquiryDraft(result, "R690");
    assert.match(draft, /CUSTOMER-SHARED SUMMARY/);
    assert.match(draft, /R690/);
    assert.match(draft, /written scope\/quote/);
    assert.match(draft, /not a technical audit or verified risk rating/);
    assert.ok(draft.length <= 2_800);
  });
});
