import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AMOUNT_BANDS,
  PRECEDENT_MATCH_LIMIT,
  amountBand,
  materialSimilarity,
  precedentAdvice,
  retrievePrecedent,
  type DecisionEpisode,
  type PrecedentMatch,
} from "./precedent.ts";

function makeEpisode(
  options: {
    id?: string;
    actionKind?: string;
    companyName?: string | null;
    amountBand?: string | null;
    stage?: string | null;
    policyVersion?: string | null;
    outcome?: "approved" | "rejected";
    exceptionConditions?: string | null;
    decidedAt?: string;
  } = {},
): DecisionEpisode {
  return {
    id: options.id ?? "ep-1",
    actionKind: options.actionKind ?? "issue_invoice",
    conditions: {
      companyName: options.companyName === undefined ? "Acme" : options.companyName,
      amountBand: options.amountBand === undefined ? "r500_to_r2500" : options.amountBand,
      stage: options.stage === undefined ? "won" : options.stage,
      jurisdiction: "ZA",
      policyVersion: options.policyVersion === undefined ? "policy-2026-01" : options.policyVersion,
    },
    reasonCode: "risk_confirmed",
    reasoning: "The founder reviewed the account and confirmed the risk on the record.",
    outcome: options.outcome ?? "approved",
    exceptionConditions: options.exceptionConditions ?? null,
    laterOutcome: null,
    decidedAt: options.decidedAt ?? "2026-01-15T10:00:00.000Z",
  };
}

function matchOf(episode: DecisionEpisode, candidate: DecisionEpisode): PrecedentMatch {
  return materialSimilarity(episode, candidate);
}

describe("precedent amount bands", () => {
  it("bands an amount into a stable bucket", () => {
    assert.equal(amountBand(0), "under_r500");
    assert.equal(amountBand(49_999), "under_r500");
    assert.equal(amountBand(50_000), "r500_to_r2500");
    assert.equal(amountBand(249_999), "r500_to_r2500");
    assert.equal(amountBand(250_000), "r2500_to_r10000");
    assert.equal(amountBand(999_999), "r2500_to_r10000");
    assert.equal(amountBand(1_000_000), "r10000_to_r25000");
    assert.equal(amountBand(2_499_999), "r10000_to_r25000");
    assert.equal(amountBand(2_500_000), "over_r25000");
    assert.equal(amountBand(25_000_000), "over_r25000");
  });

  it("treats a negative or broken amount as nothing", () => {
    assert.equal(amountBand(-1), "under_r500");
    assert.equal(amountBand(Number.NaN), "under_r500");
  });

  it("publishes every band name it can return", () => {
    assert.deepEqual(
      [...AMOUNT_BANDS],
      ["under_r500", "r500_to_r2500", "r2500_to_r10000", "r10000_to_r25000", "over_r25000"],
    );
  });
});

describe("material similarity", () => {
  it("calls an identical ruling a strong match", () => {
    const match = matchOf(makeEpisode(), makeEpisode());
    assert.equal(match.similarity, "strong_match");
    assert.equal(match.difference, null);
    assert.equal(match.effect, "evidence");
  });

  it("ignores the case of a company name", () => {
    const match = matchOf(
      makeEpisode({ companyName: "Acme" }),
      makeEpisode({ companyName: "acme" }),
    );
    assert.equal(match.similarity, "strong_match");
    assert.equal(match.difference, null);
  });

  it("names the amount band when the band no longer holds", () => {
    const match = matchOf(
      makeEpisode({ amountBand: "r500_to_r2500" }),
      makeEpisode({ amountBand: "over_r25000" }),
    );
    assert.equal(match.similarity, "related");
    assert.ok(match.difference);
    assert.ok(match.difference?.includes("amount band"));
  });

  it("names the company when the company no longer holds", () => {
    const match = matchOf(
      makeEpisode({ companyName: "Acme" }),
      makeEpisode({ companyName: "Beta" }),
    );
    assert.equal(match.similarity, "related");
    assert.ok(match.difference?.includes("company"));
  });

  it("names the stage when the stage no longer holds", () => {
    const match = matchOf(makeEpisode({ stage: "won" }), makeEpisode({ stage: "quoted" }));
    assert.equal(match.similarity, "related");
    assert.ok(match.difference?.includes("stage"));
  });

  it("names the policy version when the policy has changed", () => {
    const match = matchOf(
      makeEpisode({ policyVersion: "policy-2026-01" }),
      makeEpisode({ policyVersion: "policy-2025-07" }),
    );
    assert.equal(match.similarity, "related");
    assert.ok(match.difference?.includes("policy version"));
  });

  it("calls a different action a weak match", () => {
    const match = matchOf(
      makeEpisode({ actionKind: "issue_invoice" }),
      makeEpisode({ actionKind: "issue_quote" }),
    );
    assert.equal(match.similarity, "weak");
    assert.ok(match.difference?.includes("action"));
  });

  it("tightens after a refusal that named its exception conditions", () => {
    const match = matchOf(
      makeEpisode({ outcome: "rejected", exceptionConditions: "No written acceptance on file." }),
      makeEpisode(),
    );
    assert.equal(match.similarity, "strong_match");
    assert.equal(match.effect, "tighten");
  });

  it("keeps a refusal without exception conditions as plain evidence", () => {
    const match = matchOf(
      makeEpisode({ outcome: "rejected", exceptionConditions: null }),
      makeEpisode(),
    );
    assert.equal(match.effect, "evidence");
  });

  it("escalates a ruling made under another policy version as novel", () => {
    const match = matchOf(
      makeEpisode({ policyVersion: "policy-2025-07" }),
      makeEpisode({ policyVersion: "policy-2026-01" }),
    );
    assert.equal(match.similarity, "related");
    assert.equal(match.effect, "escalate_as_novel");
  });

  it("never returns an authority to allow anything", () => {
    const match = matchOf(makeEpisode({ outcome: "approved" }), makeEpisode());
    assert.equal(Object.keys(match).includes("allow"), false);
    assert.equal(match.effect, "evidence");
  });
});

describe("precedent retrieval", () => {
  it("puts the closest match first", () => {
    const candidate = makeEpisode();
    const strong = makeEpisode({ id: "ep-strong" });
    const related = makeEpisode({ id: "ep-related", stage: "quoted" });
    const weak = makeEpisode({ id: "ep-weak", actionKind: "issue_quote" });

    const matches = retrievePrecedent([weak, related, strong], candidate);
    assert.deepEqual(
      matches.map((match) => match.episode.id),
      ["ep-strong", "ep-related", "ep-weak"],
    );
  });

  it("leaves out a ruling with no material overlap at all", () => {
    const candidate = makeEpisode({ companyName: "Acme" });
    const unrelated = makeEpisode({
      id: "ep-unrelated",
      actionKind: "draft_reply",
      companyName: "Zebra",
    });

    const matches = retrievePrecedent([unrelated], candidate);
    assert.equal(matches.length, 0);
  });

  it("keeps a ruling that shares the company even when the action differs", () => {
    const candidate = makeEpisode({ companyName: "Acme" });
    const sameCompany = makeEpisode({ id: "ep-same", actionKind: "draft_reply" });

    const matches = retrievePrecedent([sameCompany], candidate);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].similarity, "weak");
  });

  it("shows the freshest ruling first within the same strength", () => {
    const candidate = makeEpisode();
    const older = makeEpisode({ id: "ep-old", decidedAt: "2025-01-01T00:00:00.000Z" });
    const newer = makeEpisode({ id: "ep-new", decidedAt: "2026-06-01T00:00:00.000Z" });

    const matches = retrievePrecedent([older, newer], candidate);
    assert.deepEqual(
      matches.map((match) => match.episode.id),
      ["ep-new", "ep-old"],
    );
  });

  it("caps what it puts in front of the founder", () => {
    const candidate = makeEpisode();
    const many = Array.from({ length: 9 }, (_, index) =>
      makeEpisode({
        id: `ep-${index}`,
        decidedAt: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      }),
    );

    const matches = retrievePrecedent(many, candidate);
    assert.equal(matches.length, PRECEDENT_MATCH_LIMIT);
    assert.equal(matches.length, 5);
  });

  it("returns nothing when there is no history", () => {
    assert.deepEqual(retrievePrecedent([], makeEpisode()), []);
  });
});

describe("precedent advice", () => {
  it("says plainly when there is no earlier decision", () => {
    const advice = precedentAdvice([]);
    assert.equal(advice.tighten, false);
    assert.equal(advice.novel, false);
    assert.ok(advice.guidance.includes("No earlier decision"));
    assert.ok(advice.guidance.endsWith("."));
  });

  it("calls a prior ruling evidence, not authority", () => {
    const candidate = makeEpisode();
    const matches = retrievePrecedent([makeEpisode()], candidate);
    const advice = precedentAdvice(matches);

    assert.equal(advice.tighten, false);
    assert.equal(advice.novel, false);
    assert.ok(advice.guidance.includes("evidence, not authority"));
  });

  it("flags a tightening when a similar decision was refused", () => {
    const candidate = makeEpisode();
    const matches = retrievePrecedent(
      [makeEpisode({ outcome: "rejected", exceptionConditions: "No written acceptance." })],
      candidate,
    );
    const advice = precedentAdvice(matches);

    assert.equal(advice.tighten, true);
    assert.equal(advice.novel, false);
    assert.ok(advice.guidance.includes("refused"));
  });

  it("flags novelty when the policy has moved on", () => {
    const candidate = makeEpisode({ policyVersion: "policy-2026-01" });
    const matches = retrievePrecedent(
      [makeEpisode({ policyVersion: "policy-2025-07" })],
      candidate,
    );
    const advice = precedentAdvice(matches);

    assert.equal(advice.novel, true);
    assert.equal(advice.tighten, false);
    assert.ok(advice.guidance.includes("new"));
  });

  it("gives the founder one sentence, not a page", () => {
    const candidate = makeEpisode();
    const matches = retrievePrecedent([makeEpisode()], candidate);
    const advice = precedentAdvice(matches);

    assert.equal(advice.guidance.split(". ").length, 1);
  });
});
