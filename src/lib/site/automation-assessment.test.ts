import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assessAutomation,
  AUTOMATION_QUESTIONS,
  type AutomationAnswers,
  createAutomationBrief,
} from "./automation-assessment.ts";

describe("AI automation opportunity assessment", () => {
  it("waits until every workflow question has an answer", () => {
    assert.equal(assessAutomation({}), null);
    assert.equal(
      assessAutomation(
        Object.fromEntries(
          AUTOMATION_QUESTIONS.slice(1).map((question) => [question.id, "yes"]),
        ) as AutomationAnswers,
      ),
      null,
    );
  });

  it("identifies a bounded low-impact workflow as a pilot candidate", () => {
    const result = assessAutomation({
      frequency: "daily",
      repeatability: "yes",
      inputs: "structured",
      exceptions: "known",
      impact: "low",
      approval: "defined",
    });

    assert.equal(result?.category, "good-candidate");
    assert.match(result?.summary ?? "", /not a case for unrestricted autonomy/);
    assert.equal(result?.actions.length, 3);
  });

  it("requires human-reviewed controls for high-impact workflows", () => {
    const result = assessAutomation({
      frequency: "daily",
      repeatability: "yes",
      inputs: "structured",
      exceptions: "known",
      impact: "high",
      approval: "defined",
    });

    assert.equal(result?.category, "prepare-first");
    assert.match(result?.summary ?? "", /human-reviewed/);
  });

  it("does not recommend hands-off work when approval ownership is absent", () => {
    const result = assessAutomation({
      frequency: "daily",
      repeatability: "yes",
      inputs: "structured",
      exceptions: "known",
      impact: "low",
      approval: "no",
    });

    assert.equal(result?.category, "prepare-first");
  });

  it("keeps incomplete processes in a guarded pilot", () => {
    const result = assessAutomation({
      frequency: "weekly",
      repeatability: "partly",
      inputs: "unstructured",
      exceptions: "some",
      impact: "moderate",
      approval: "unclear",
    });

    assert.equal(result?.category, "guarded-pilot");
    assert.equal(result?.serviceSlug, "cloud-email");
  });

  it("creates a local, readable brief from a completed assessment", () => {
    const answers: AutomationAnswers = {
      frequency: "daily",
      repeatability: "yes",
      inputs: "structured",
      exceptions: "known",
      impact: "low",
      approval: "defined",
    };
    const outcome = assessAutomation(answers);

    assert.ok(outcome);
    const brief = createAutomationBrief(answers, outcome);

    assert.ok(brief);
    assert.match(brief, /VANTAGE-ARS · AI WORKFLOW PILOT BRIEF/);
    assert.match(brief, /Work volume: Several times a day/);
    assert.match(brief, /SUGGESTED NEXT STEPS/);
    assert.match(brief, /Do not use this brief to authorize unattended/);
  });

  it("does not create a brief from an incomplete checklist", () => {
    const outcome = assessAutomation({
      frequency: "daily",
      repeatability: "yes",
      inputs: "structured",
      exceptions: "known",
      impact: "low",
      approval: "defined",
    });

    assert.ok(outcome);
    assert.equal(createAutomationBrief({ frequency: "daily" }, outcome), null);
  });
});
