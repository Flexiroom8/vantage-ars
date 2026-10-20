import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assessRisk, HIGH_VALUE_CENTS, RISK_TIER_LABELS, type RiskTierName } from "./risk.ts";
import { ACTION_KINDS } from "./types.ts";

/**
 * Every action kind the office knows, with the tier it lands in when nothing
 * else distinguishes it (no amount, no payload).
 */
const EXPECTED_TIER: Record<string, RiskTierName> = {
  route_inbound: "4-Ambiguous",
  draft_reply: "5-Routine",
  create_lead: "5-Routine",
  update_lead: "4-Ambiguous",
  draft_campaign: "5-Routine",
  activate_campaign: "1-Financial",
  handoff_to_sales: "4-Ambiguous",
  open_opportunity: "3-Value",
  advance_opportunity: "5-Routine",
  issue_quote: "3-Value",
  propose_close_won: "2-Destructive",
  propose_close_lost: "1-Legal",
  issue_invoice: "3-Value",
  record_expense: "1-Financial",
  record_inbound_payment: "3-Value",
  open_ticket: "5-Routine",
  update_ticket: "5-Routine",
  draft_document: "5-Routine",
  notify_operator: "5-Routine",
  escalate_account_risk: "1-Legal",
  fulfil_service: "5-Routine",
  start_subscription: "5-Routine",
  cancel_subscription: "1-Legal",
  send_customer_mail: "5-Routine",
};

/** The tiers a human must clear before the action reaches the outside world. */
const GATED_TIERS: Record<RiskTierName, boolean> = {
  "1-Legal": true,
  "1-Financial": true,
  "2-Destructive": true,
  "3-Value": true,
  "4-Ambiguous": false,
  "5-Routine": false,
};

describe("risk tiers", () => {
  it("knows every action kind the office can propose", () => {
    assert.equal(Object.keys(EXPECTED_TIER).length, ACTION_KINDS.length);
    for (const kind of ACTION_KINDS) {
      assert.ok(EXPECTED_TIER[kind], `no expected tier recorded for ${kind}`);
    }
  });

  it("maps every action kind to its tier", () => {
    for (const kind of ACTION_KINDS) {
      const assessment = assessRisk({ kind });
      assert.equal(assessment.name, EXPECTED_TIER[kind], `${kind} landed in the wrong tier`);
      assert.ok(assessment.rationale.length > 0, `${kind} needs a rationale`);
    }
  });

  it("reads the legal tier from the action kind alone", () => {
    for (const kind of ["propose_close_lost", "escalate_account_risk", "cancel_subscription"]) {
      const assessment = assessRisk({ kind });
      assert.equal(assessment.name, "1-Legal");
      assert.equal(assessment.tier, 1);
      assert.equal(assessment.personalData, true);
    }
  });

  it("treats money leaving the company as financial, whatever the amount", () => {
    for (const kind of ["record_expense", "activate_campaign"]) {
      assert.equal(assessRisk({ kind }).name, "1-Financial");
      assert.equal(assessRisk({ kind, amountCents: 1 }).name, "1-Financial");
      assert.equal(assessRisk({ kind, amountCents: HIGH_VALUE_CENTS * 10 }).name, "1-Financial");
    }
  });

  it("gates an invoice at the high-value line and not a cent below it", () => {
    const threshold = assessRisk({ kind: "issue_invoice", amountCents: HIGH_VALUE_CENTS });
    assert.equal(threshold.name, "1-Financial");
    assert.equal(threshold.tier, 1);
    assert.equal(threshold.gated, true);

    const below = assessRisk({ kind: "issue_invoice", amountCents: HIGH_VALUE_CENTS - 1 });
    assert.equal(below.name, "3-Value");
    assert.equal(below.tier, 3);
    assert.equal(below.gated, true);
  });

  it("publishes the high-value line as R25 000", () => {
    assert.equal(HIGH_VALUE_CENTS, 2_500_000);
  });

  it("treats a large inbound payment as destructive and a small one as value", () => {
    const large = assessRisk({
      kind: "record_inbound_payment",
      amountCents: HIGH_VALUE_CENTS,
    });
    assert.equal(large.name, "2-Destructive");
    assert.equal(large.gated, true);

    const below = assessRisk({
      kind: "record_inbound_payment",
      amountCents: HIGH_VALUE_CENTS - 1,
    });
    assert.equal(below.name, "3-Value");
  });

  it("treats a close of an existing customer as destructive", () => {
    const existing = assessRisk({
      kind: "propose_close_won",
      payload: { priorContact: true },
    });
    assert.equal(existing.name, "2-Destructive");
    assert.equal(existing.gated, true);
  });

  it("treats a close of a brand new customer as value", () => {
    const fresh = assessRisk({
      kind: "propose_close_won",
      payload: { newCustomer: true },
    });
    assert.equal(fresh.name, "3-Value");
    assert.equal(fresh.gated, true);
  });

  it("defaults an unmarked close to the destructive tier", () => {
    assert.equal(assessRisk({ kind: "propose_close_won" }).name, "2-Destructive");
    assert.equal(assessRisk({ kind: "propose_close_won", payload: {} }).name, "2-Destructive");
  });

  it("treats judgement calls without an outside effect as ambiguous", () => {
    for (const kind of ["route_inbound", "update_lead", "handoff_to_sales"]) {
      const assessment = assessRisk({ kind });
      assert.equal(assessment.name, "4-Ambiguous");
      assert.equal(assessment.gated, false);
    }
  });

  it("treats ordinary work as routine and ungated", () => {
    for (const kind of [
      "create_lead",
      "update_ticket",
      "draft_document",
      "draft_reply",
      "draft_campaign",
      "notify_operator",
      "open_ticket",
    ]) {
      const assessment = assessRisk({ kind });
      assert.equal(assessment.name, "5-Routine");
      assert.equal(assessment.gated, false);
    }
  });

  it("gates exactly tiers one to three", () => {
    for (const kind of ACTION_KINDS) {
      const assessment = assessRisk({ kind });
      assert.equal(assessment.gated, GATED_TIERS[assessment.name], `${kind} gated wrongly`);
    }
  });

  it("treats an unknown action kind as routine rather than as special", () => {
    const assessment = assessRisk({ kind: "invent_a_new_kind" });
    assert.equal(assessment.name, "5-Routine");
    assert.equal(assessment.gated, false);
    assert.ok(assessment.rationale.includes("not an action kind the office knows"));
  });

  it("does not read the company name to decide personal-data reach", () => {
    const namedAfterAPerson = assessRisk({
      kind: "create_lead",
      companyName: "Pieter Botha Trading",
    });
    assert.equal(namedAfterAPerson.personalData, false);

    const legallyReached = assessRisk({
      kind: "propose_close_lost",
      companyName: "Acme Holdings (Pty) Ltd",
    });
    assert.equal(legallyReached.personalData, true);
  });

  it("marks the actions that write to a person as personal data", () => {
    assert.equal(assessRisk({ kind: "send_customer_mail" }).personalData, true);
    assert.equal(assessRisk({ kind: "draft_reply" }).personalData, true);
    assert.equal(assessRisk({ kind: "issue_quote" }).personalData, false);
    assert.equal(assessRisk({ kind: "record_expense" }).personalData, false);
  });

  it("labels every tier with one plain sentence", () => {
    const names = Object.keys(RISK_TIER_LABELS) as RiskTierName[];
    assert.equal(names.length, 6);
    for (const name of names) {
      const label = RISK_TIER_LABELS[name];
      assert.ok(label.length > 0, `${name} has no label`);
      assert.ok(label.endsWith("."), `${name} label is not a sentence`);
    }
  });

  it("explains itself in a sentence the founder can read", () => {
    const atThreshold = assessRisk({
      kind: "issue_invoice",
      amountCents: HIGH_VALUE_CENTS,
    });
    const belowThreshold = assessRisk({
      kind: "issue_invoice",
      amountCents: HIGH_VALUE_CENTS - 1,
    });

    assert.ok(atThreshold.rationale.includes("high-value line"));
    assert.ok(belowThreshold.rationale.includes("below"));
    assert.notEqual(atThreshold.rationale, belowThreshold.rationale);
    assert.ok(atThreshold.rationale.endsWith("."));
  });
});
