/**
 * Governed precedent memory.
 *
 * Why this module exists: an office that decides the same kind of question
 * twice should be able to show the founder what it did last time, under what
 * conditions, and why. That is the difference between an office that learns
 * and one that merely repeats itself.
 *
 * The hard rule of this module: a prior ruling is EVIDENCE, NEVER AUTHORITY.
 * Nothing here can allow an action, and nothing here returns "allow". A
 * precedent may show the founder a pattern, may tighten the checks after a
 * past refusal, or may tell the office that the world has moved on and the
 * decision is new — nothing more. The authority stays with the founder.
 *
 * What it deliberately does not do:
 *   - it does not read the database or the clock. Episodes are handed to it;
 *   - it does not decide whether an action is permitted;
 *   - it does not look past the MATERIAL conditions. The material conditions
 *     are the action kind, the company, the amount band, the stage and the
 *     policy version. A ruling made under different material conditions is
 *     not a ruling about this case;
 *   - it does not treat two decisions as the same because their titles look
 *     alike. Only the material conditions count.
 *
 * Pure module: no database, no clock, no environment. Unit tested directly.
 */

export type DecisionEpisode = {
  id: string;
  actionKind: string;
  /** The material conditions the ruling was made under. */
  conditions: {
    companyName?: string | null;
    amountBand?: string | null;
    stage?: string | null;
    jurisdiction?: string | null;
    policyVersion?: string | null;
  };
  reasonCode: string;
  reasoning: string;
  outcome: "approved" | "rejected";
  /** What would have changed the decision. */
  exceptionConditions: string | null;
  laterOutcome: string | null;
  decidedAt: string;
};

export type PrecedentMatch = {
  episode: DecisionEpisode;
  /** "strong_match" | "related" | "weak" */
  similarity: "strong_match" | "related" | "weak";
  /** Plain sentence describing the difference, e.g. "The amount band no longer holds." */
  difference: string | null;
  /** What the gate should do with this precedent. */
  effect: "evidence" | "tighten" | "escalate_as_novel";
};

/**
 * The amount bands the office compares on.
 *
 * Named and exported so a decision record can say "r2500_to_r10000" and
 * everyone means the same thing. The top band starts at R25 000.00, the same
 * line the risk module calls high value.
 */
export const AMOUNT_BANDS = [
  "under_r500",
  "r500_to_r2500",
  "r2500_to_r10000",
  "r10000_to_r25000",
  "over_r25000",
] as const;

export type AmountBand = (typeof AMOUNT_BANDS)[number];

/** The band edges in cents, lowest first: R500, R2 500, R10 000, R25 000. */
const BAND_EDGES_CENTS = [50_000, 250_000, 1_000_000, 2_500_000] as const;

/** How many matches the office will put in front of the founder. */
export const PRECEDENT_MATCH_LIMIT = 5;

/**
 * Bucket an amount in cents into a stable band.
 *
 * Bands are compared on the band, never on the exact cents: a ruling about
 * R240 should still speak to a ruling about R480, because the point of a band
 * is that small differences do not change the material conditions.
 */
export function amountBand(cents: number): AmountBand {
  const value = Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0;
  if (value < BAND_EDGES_CENTS[0]) return "under_r500";
  if (value < BAND_EDGES_CENTS[1]) return "r500_to_r2500";
  if (value < BAND_EDGES_CENTS[2]) return "r2500_to_r10000";
  if (value < BAND_EDGES_CENTS[3]) return "r10000_to_r25000";
  return "over_r25000";
}

/** Lower-case and trim a material value; blank and missing read the same. */
function normalise(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = value.trim().toLowerCase();
  return text === "" ? null : text;
}

function companyOf(episode: DecisionEpisode): string | null {
  return normalise(episode.conditions.companyName);
}

function actionOf(episode: DecisionEpisode): string | null {
  return normalise(episode.actionKind);
}

function bandOf(episode: DecisionEpisode): string | null {
  return normalise(episode.conditions.amountBand);
}

function stageOf(episode: DecisionEpisode): string | null {
  return normalise(episode.conditions.stage);
}

function policyOf(episode: DecisionEpisode): string | null {
  return normalise(episode.conditions.policyVersion);
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * The sentences that name a difference between two rulings.
 *
 * Each one says a single thing, in plain words, in a fixed order, so two
 * auditors reading the same pair of rulings write down the same difference.
 */
const DIFFERENCE_SENTENCES = {
  action: "The action is different.",
  company: "The company no longer holds.",
  amountBand: "The amount band no longer holds.",
  stage: "The stage no longer holds.",
  policyVersion: "The policy version no longer holds.",
} as const;

type DifferenceKey = keyof typeof DIFFERENCE_SENTENCES;

/**
 * The material conditions that differ between two rulings, in a fixed order.
 */
function differencesBetween(a: DecisionEpisode, b: DecisionEpisode): DifferenceKey[] {
  const differences: DifferenceKey[] = [];
  if (actionOf(a) !== actionOf(b)) differences.push("action");
  if (companyOf(a) !== companyOf(b)) differences.push("company");
  if (bandOf(a) !== bandOf(b)) differences.push("amountBand");
  if (stageOf(a) !== stageOf(b)) differences.push("stage");
  if (policyOf(a) !== policyOf(b)) differences.push("policyVersion");
  return differences;
}

/**
 * Compare two rulings on the material conditions only.
 *
 * `a` is the earlier ruling, `b` is the one in hand.
 */
export function materialSimilarity(a: DecisionEpisode, b: DecisionEpisode): PrecedentMatch {
  const differences = differencesBetween(a, b);
  const sameAction = !differences.includes("action");
  const samePolicy = !differences.includes("policyVersion");

  const similarity: PrecedentMatch["similarity"] = !sameAction
    ? "weak"
    : differences.length === 0
      ? "strong_match"
      : "related";

  const difference =
    differences.length === 0 ? null : differences.map((key) => DIFFERENCE_SENTENCES[key]).join(" ");

  return {
    episode: a,
    similarity,
    difference,
    effect: effectFor(a, similarity, !samePolicy),
  };
}

/**
 * What the gate should do with a precedent.
 *
 * A refusal that named its exception conditions tightens the checks: the same
 * shape of action with those conditions present has already been refused once.
 * A ruling made under a different policy version says the world has moved, so
 * it is treated as a novel case rather than as evidence. Where both apply,
 * the refusal wins, because the refusal is the more specific instruction.
 */
function effectFor(
  episode: DecisionEpisode,
  similarity: PrecedentMatch["similarity"],
  policyDiffers: boolean,
): PrecedentMatch["effect"] {
  if (
    similarity !== "weak" &&
    episode.outcome === "rejected" &&
    hasText(episode.exceptionConditions)
  ) {
    return "tighten";
  }
  if (policyDiffers) return "escalate_as_novel";
  return "evidence";
}

/**
 * Find the closest earlier rulings for a candidate decision.
 *
 * The closest matches come first, and the list is capped so the founder is
 * never handed a wall of history. Rulings with no material overlap at all are
 * left out entirely: a refusal on a different action at a different company
 * is not evidence about this one.
 */
export function retrievePrecedent(
  episodes: DecisionEpisode[],
  candidate: DecisionEpisode,
): PrecedentMatch[] {
  const candidateCompany = companyOf(candidate);
  const candidateAction = actionOf(candidate);

  const matches: PrecedentMatch[] = [];

  for (const episode of episodes) {
    const match = materialSimilarity(episode, candidate);
    const sameAction = actionOf(episode) === candidateAction;
    const sameCompany = companyOf(episode) === candidateCompany;

    if (match.similarity === "weak" && !sameAction && !sameCompany) continue;

    matches.push(match);
  }

  const ranked = [...matches].sort((left, right) => {
    const rank = rankOf(left.similarity) - rankOf(right.similarity);
    if (rank !== 0) return rank;

    const spread =
      differencesBetween(left.episode, candidate).length -
      differencesBetween(right.episode, candidate).length;
    if (spread !== 0) return spread;

    // Most recent first, so the freshest ruling is the one in front.
    if (left.episode.decidedAt !== right.episode.decidedAt) {
      return left.episode.decidedAt < right.episode.decidedAt ? 1 : -1;
    }
    return left.episode.id < right.episode.id ? -1 : 1;
  });

  return ranked.slice(0, PRECEDENT_MATCH_LIMIT);
}

function rankOf(similarity: PrecedentMatch["similarity"]): number {
  if (similarity === "strong_match") return 0;
  if (similarity === "related") return 1;
  return 2;
}

/**
 * Turn the matches into one plain sentence for the founder.
 *
 * A precedent is evidence, not authority, and the sentence says so.
 */
export function precedentAdvice(matches: PrecedentMatch[]): {
  guidance: string;
  tighten: boolean;
  novel: boolean;
} {
  const tighten = matches.some((match) => match.effect === "tighten");
  const novel = matches.some((match) => match.effect === "escalate_as_novel");

  if (matches.length === 0) {
    return {
      guidance:
        "No earlier decision on these terms is on record, so this is a new decision for the founder.",
      tighten,
      novel,
    };
  }

  if (tighten && novel) {
    return {
      guidance:
        "A similar decision was refused before and the policy has changed since, so treat this one as new and escalate it to the founder.",
      tighten,
      novel,
    };
  }

  if (tighten) {
    return {
      guidance:
        "A similar decision was refused before, so tighten the checks and show the founder what would have changed the outcome.",
      tighten,
      novel,
    };
  }

  if (novel) {
    return {
      guidance:
        "The closest earlier decision was made under a different policy version, so treat this one as new and escalate it to the founder.",
      tighten,
      novel,
    };
  }

  const count = matches.length;
  return {
    guidance: `Earlier rulings on these terms are evidence, not authority: show the founder ${count === 1 ? "the one" : `the ${count}`} and decide afresh.`,
    tighten,
    novel,
  };
}
