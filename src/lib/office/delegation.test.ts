import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DELEGATABLE_ACTIONS,
  DELEGATION_PRESETS,
  delegatableRateIds,
  evaluateDelegation,
  isDelegatableRate,
  type DelegationAction,
  type DelegationPolicy,
  type DelegationRequest,
} from "./delegation.ts";
import { PUBLISHED_RATES } from "./catalogue.ts";

const ALL_ACTIONS: DelegationAction[] = [...DELEGATABLE_ACTIONS];

function policy(overrides: Partial<DelegationPolicy> = {}): DelegationPolicy {
  return {
    id: "del-1",
    label: "Test delegation",
    status: "active",
    maxAmountCents: 100000,
    maxActionsPerDay: 5,
    maxActionsPerMonth: 20,
    allowedActions: [...ALL_ACTIONS],
    allowedRateIds: ["managed-support", "health-watch", "service-report"],
    allowCustomerMail: true,
    allowAutoReconcile: false,
    requireAcceptedQuote: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    revokedAt: null,
    ...overrides,
  };
}

function request(overrides: Partial<DelegationRequest> = {}): DelegationRequest {
  return {
    action: "fulfil_service",
    amountCents: 0,
    rateId: null,
    acceptedQuote: true,
    opportunityWon: true,
    realEnquiry: true,
    usedToday: 0,
    usedThisMonth: 0,
    ...overrides,
  };
}

describe("delegation without a policy", () => {
  it("refuses everything when no standing delegation exists", () => {
    const verdict = evaluateDelegation(null, request());
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.check, "no_delegation");
    assert.equal(verdict.reason.length > 0, true);
  });

  it("refuses everything even for the most ordinary action", () => {
    for (const action of ALL_ACTIONS) {
      const verdict = evaluateDelegation(null, request({ action }));
      assert.equal(verdict.allowed, false);
      assert.equal(verdict.check, "no_delegation");
    }
  });
});

describe("delegation status", () => {
  it("stops at once when the founder has revoked the delegation", () => {
    const verdict = evaluateDelegation(
      policy({ status: "revoked", revokedAt: "2026-02-01T00:00:00.000Z" }),
      request(),
    );
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.check, "revoked");
  });

  it("stops while the delegation is paused", () => {
    const verdict = evaluateDelegation(policy({ status: "paused" }), request());
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.check, "paused");
  });

  it("lets an active delegation through", () => {
    const verdict = evaluateDelegation(policy(), request());
    assert.equal(verdict.allowed, true);
    assert.equal(verdict.check, "delegated");
  });
});

describe("delegated actions", () => {
  it("refuses an action the delegation does not cover", () => {
    const verdict = evaluateDelegation(
      policy({ allowedActions: ["issue_invoice"] }),
      request({ action: "fulfil_service" }),
    );
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.check, "action_not_delegated");
    assert.equal(verdict.reason.includes("fulfil_service"), true);
  });

  it("allows nothing at all when the delegation names no actions", () => {
    for (const action of ALL_ACTIONS) {
      const verdict = evaluateDelegation(policy({ allowedActions: [] }), request({ action }));
      assert.equal(verdict.allowed, false);
      assert.equal(verdict.check, "action_not_delegated");
    }
  });
});

describe("delegated amounts", () => {
  it("refuses a single action over the cap", () => {
    const verdict = evaluateDelegation(
      policy({ maxAmountCents: 100000 }),
      request({ action: "issue_invoice", amountCents: 100001 }),
    );
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.check, "amount_over_cap");
  });

  it("allows a single action exactly at the cap", () => {
    const verdict = evaluateDelegation(
      policy({ maxAmountCents: 100000 }),
      request({ action: "issue_invoice", amountCents: 100000 }),
    );
    assert.equal(verdict.allowed, true);
    assert.equal(verdict.check, "delegated");
  });

  it("treats a negative amount as nothing", () => {
    const verdict = evaluateDelegation(
      policy({ maxAmountCents: 0 }),
      request({ action: "issue_invoice", amountCents: -500 }),
    );
    assert.equal(verdict.allowed, true);
  });
});

describe("delegated usage caps", () => {
  it("refuses once the daily cap has been used", () => {
    const verdict = evaluateDelegation(policy({ maxActionsPerDay: 5 }), request({ usedToday: 5 }));
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.check, "daily_cap_reached");
  });

  it("allows an action below the daily cap", () => {
    const verdict = evaluateDelegation(policy({ maxActionsPerDay: 5 }), request({ usedToday: 4 }));
    assert.equal(verdict.allowed, true);
  });

  it("refuses once the monthly cap has been used", () => {
    const verdict = evaluateDelegation(
      policy({ maxActionsPerMonth: 20 }),
      request({ usedToday: 0, usedThisMonth: 20 }),
    );
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.check, "monthly_cap_reached");
  });

  it("allows an action below the monthly cap", () => {
    const verdict = evaluateDelegation(
      policy({ maxActionsPerMonth: 20 }),
      request({ usedToday: 0, usedThisMonth: 19 }),
    );
    assert.equal(verdict.allowed, true);
  });

  it("treats a zero cap as no cap rather than as no allowance", () => {
    const verdict = evaluateDelegation(
      policy({ maxActionsPerDay: 0, maxActionsPerMonth: 0 }),
      request({ usedToday: 99, usedThisMonth: 99 }),
    );
    assert.equal(verdict.allowed, true);
  });
});

describe("delegated rate lines", () => {
  it("refuses a rate that is not an offered published rate", () => {
    const verdict = evaluateDelegation(
      policy({ allowedRateIds: ["managed-support", "no-such-rate"] }),
      request({ action: "issue_invoice", amountCents: 69000, rateId: "no-such-rate" }),
    );
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.check, "rate_not_published");
  });

  it("refuses a published rate the delegation does not cover", () => {
    const verdict = evaluateDelegation(
      policy({ allowedRateIds: ["managed-support"] }),
      request({ action: "issue_invoice", amountCents: 69000, rateId: "billing-audit" }),
    );
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.check, "rate_not_delegated");
    assert.equal(verdict.reason.includes("billing-audit"), true);
  });

  it("allows a published rate the delegation covers", () => {
    const verdict = evaluateDelegation(
      policy({ allowedRateIds: ["managed-support", "health-watch"] }),
      request({ action: "issue_invoice", amountCents: 99000, rateId: "health-watch" }),
    );
    assert.equal(verdict.allowed, true);
    assert.equal(verdict.check, "delegated");
  });

  it("lists only the offered published rates as delegatable", () => {
    const ids = delegatableRateIds();
    for (const id of ids) {
      const rate = PUBLISHED_RATES.find((item) => item.id === id);
      if (!rate) assert.fail(`${id} is not on the published card`);
      assert.equal(rate.offered, true);
      assert.equal(isDelegatableRate(id), true);
    }
    assert.equal(isDelegatableRate("no-such-rate"), false);
    assert.equal(ids.includes("managed-support"), true);
  });
});

describe("delegation preconditions", () => {
  it("refuses when an accepted quote is required and there is none", () => {
    const verdict = evaluateDelegation(
      policy({ requireAcceptedQuote: true }),
      request({ action: "fulfil_service", acceptedQuote: false }),
    );
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.check, "no_accepted_quote");
  });

  it("allows an accepted quote through a delegation that requires one", () => {
    const verdict = evaluateDelegation(
      policy({ requireAcceptedQuote: true }),
      request({ action: "fulfil_service", acceptedQuote: true }),
    );
    assert.equal(verdict.allowed, true);
  });

  it("does not block opening work or issuing the first quote", () => {
    for (const action of ["open_opportunity", "issue_quote"] as const) {
      const verdict = evaluateDelegation(
        policy({ requireAcceptedQuote: true }),
        request({
          action,
          acceptedQuote: false,
          realEnquiry: true,
          rateId: action === "issue_quote" ? "managed-support" : null,
          amountCents: action === "issue_quote" ? 69000 : 0,
        }),
      );
      assert.equal(verdict.allowed, true, `${action} was blocked by the accepted-quote gate`);
    }
  });

  it("still blocks money and delivery without an accepted quote", () => {
    for (const action of [
      "issue_invoice",
      "record_inbound_payment",
      "start_subscription",
      "fulfil_service",
      "cancel_subscription",
      "propose_close_won",
    ] as const) {
      const verdict = evaluateDelegation(
        policy({ requireAcceptedQuote: true }),
        request({
          action,
          acceptedQuote: false,
          opportunityWon: action === "issue_invoice",
          realEnquiry: true,
        }),
      );
      assert.equal(verdict.allowed, false, `${action} ignored the accepted-quote gate`);
      assert.equal(verdict.check, "no_accepted_quote");
    }
  });

  it("will not charge for work that was neither quoted nor won", () => {
    const money: DelegationAction[] = [
      "issue_invoice",
      "record_inbound_payment",
      "start_subscription",
    ];
    for (const action of money) {
      const verdict = evaluateDelegation(
        policy({ requireAcceptedQuote: false }),
        request({
          action,
          amountCents: 69000,
          acceptedQuote: false,
          opportunityWon: false,
        }),
      );
      assert.equal(verdict.allowed, false);
      assert.equal(verdict.check, "no_won_work");
    }
  });

  it("accepts a won opportunity as enough to charge", () => {
    const verdict = evaluateDelegation(
      policy({ requireAcceptedQuote: false }),
      request({
        action: "issue_invoice",
        amountCents: 69000,
        acceptedQuote: false,
        opportunityWon: true,
      }),
    );
    assert.equal(verdict.allowed, true);
  });

  it("will not sell to a customer who did not contact the office", () => {
    const selling: DelegationAction[] = ["open_opportunity", "issue_quote", "propose_close_won"];
    for (const action of selling) {
      const verdict = evaluateDelegation(
        policy({ requireAcceptedQuote: false }),
        request({ action, acceptedQuote: false, realEnquiry: false }),
      );
      assert.equal(verdict.allowed, false);
      assert.equal(verdict.check, "no_real_enquiry");
    }
  });

  it("sells to a real enquiry", () => {
    for (const action of ["open_opportunity", "issue_quote", "propose_close_won"] as const) {
      const verdict = evaluateDelegation(
        policy({ requireAcceptedQuote: false }),
        request({ action, acceptedQuote: false, realEnquiry: true }),
      );
      assert.equal(verdict.allowed, true);
      assert.equal(verdict.check, "delegated");
    }
  });
});

describe("delegated customer mail", () => {
  it("will not email the customer unless mail is delegated", () => {
    const verdict = evaluateDelegation(
      policy({ allowCustomerMail: false }),
      request({ action: "send_customer_mail" }),
    );
    assert.equal(verdict.allowed, false);
    assert.equal(verdict.check, "mail_not_delegated");
  });

  it("emails the customer when mail is delegated and the action is listed", () => {
    const verdict = evaluateDelegation(
      policy({ allowCustomerMail: true, allowedActions: ["send_customer_mail"] }),
      request({ action: "send_customer_mail" }),
    );
    assert.equal(verdict.allowed, true);
    assert.equal(verdict.check, "delegated");
  });
});

describe("delegation presets", () => {
  it("gives every preset a unique id", () => {
    const ids = DELEGATION_PRESETS.map((preset) => preset.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("only ever names delegatable actions", () => {
    for (const preset of DELEGATION_PRESETS) {
      for (const action of preset.allowedActions) {
        assert.equal(
          (DELEGATABLE_ACTIONS as readonly string[]).includes(action),
          true,
          `${preset.id} names ${action}, which is not delegatable`,
        );
      }
    }
  });

  it("never delegates customer mail without also allowing it", () => {
    for (const preset of DELEGATION_PRESETS) {
      if (preset.allowedActions.includes("send_customer_mail")) {
        assert.equal(preset.allowCustomerMail, true, `${preset.id} lists mail but forbids it`);
      }
    }
  });

  it("delegates nothing at all under the observe preset", () => {
    const observe = DELEGATION_PRESETS.find((preset) => preset.id === "observe");
    if (!observe) assert.fail("the observe preset is missing");
    assert.deepEqual(observe.allowedActions, []);
    assert.equal(observe.allowCustomerMail, false);
    for (const action of ALL_ACTIONS) {
      const verdict = evaluateDelegation(
        policy({
          allowedActions: observe.allowedActions,
          allowCustomerMail: observe.allowCustomerMail,
        }),
        request({ action }),
      );
      assert.equal(verdict.allowed, false);
      assert.equal(verdict.check, "action_not_delegated");
    }
  });

  it("keeps the delivery preset away from selling and money", () => {
    const delivery = DELEGATION_PRESETS.find((preset) => preset.id === "delivery");
    if (!delivery) assert.fail("the delivery preset is missing");
    assert.equal(delivery.allowedActions.includes("fulfil_service"), true);
    assert.equal(delivery.allowedActions.includes("send_customer_mail"), true);
    assert.equal(delivery.allowedActions.includes("issue_invoice"), false);
    assert.equal(delivery.allowedActions.includes("issue_quote"), false);
  });

  it("lets the revenue preset sell and charge, but only to a real enquiry", () => {
    const revenue = DELEGATION_PRESETS.find((preset) => preset.id === "revenue");
    if (!revenue) assert.fail("the revenue preset is missing");
    assert.equal(revenue.allowedActions.includes("open_opportunity"), true);
    assert.equal(revenue.allowedActions.includes("issue_invoice"), true);
    assert.equal(revenue.requireAcceptedQuote, false);

    const selling = policy({
      allowedActions: revenue.allowedActions,
      allowCustomerMail: revenue.allowCustomerMail,
      requireAcceptedQuote: revenue.requireAcceptedQuote,
    });
    const refused = evaluateDelegation(
      selling,
      request({ action: "issue_quote", acceptedQuote: false, realEnquiry: false }),
    );
    assert.equal(refused.allowed, false);
    assert.equal(refused.check, "no_real_enquiry");

    const allowed = evaluateDelegation(
      selling,
      request({ action: "issue_quote", acceptedQuote: false, realEnquiry: true }),
    );
    assert.equal(allowed.allowed, true);
  });
});
