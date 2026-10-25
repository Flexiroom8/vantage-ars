export type AssessmentAnswer = "unknown" | "no" | "partial" | "yes";

export type AssessmentQuestion = {
  id: string;
  topic: string;
  prompt: string;
  serviceSlug: string;
  nextStep: string;
};

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: "accounts",
    topic: "Accounts and access",
    prompt:
      "Are administrator accounts limited to named people and protected with multi-factor authentication?",
    serviceSlug: "security",
    nextStep: "Review administrator access, sign-in protection and account ownership.",
  },
  {
    id: "backups",
    topic: "Backups and recovery",
    prompt: "Have you tested restoring important business data from a backup in the last year?",
    serviceSlug: "backup-recovery",
    nextStep: "Confirm what is backed up, who can restore it and whether a real restore works.",
  },
  {
    id: "network",
    topic: "Network",
    prompt: "Is there a current record of your internet, router, Wi-Fi and network equipment?",
    serviceSlug: "networking",
    nextStep: "Document the network layout, equipment and the dependencies staff rely on.",
  },
  {
    id: "systems",
    topic: "Systems and devices",
    prompt:
      "Can someone identify the business-critical computers, servers and their support or renewal dates?",
    serviceSlug: "it-infrastructure",
    nextStep: "Build an inventory of critical systems, ownership and upcoming changes.",
  },
  {
    id: "email",
    topic: "Email and cloud",
    prompt:
      "Are business email accounts and domains owned by the business, with a named administrator and recovery method?",
    serviceSlug: "cloud-email",
    nextStep: "Check tenant ownership, administrator recovery and domain configuration.",
  },
  {
    id: "support",
    topic: "Support and changes",
    prompt:
      "Is there a written place to record faults, changes made and the person responsible for follow-up?",
    serviceSlug: "managed-support",
    nextStep: "Create a simple record of faults, decisions, changes and their outcomes.",
  },
  {
    id: "continuity",
    topic: "Continuity",
    prompt:
      "Do you have a written first-response plan for an outage, including who decides what to restore first?",
    serviceSlug: "backup-recovery",
    nextStep: "Write down key contacts, recovery priorities and the first steps during an outage.",
  },
] as const;

export type AssessmentQuestionId = (typeof ASSESSMENT_QUESTIONS)[number]["id"];
export type AssessmentAnswers = Partial<Record<AssessmentQuestionId, AssessmentAnswer>>;
export type AssessmentFinding = AssessmentQuestion & {
  answer: AssessmentAnswer;
  status: "verify" | "improve" | "maintain";
};

export type AssessmentResult = {
  score: number | null;
  reviewed: number;
  unverified: number;
  label:
    | "Limited evidence"
    | "Practices developing"
    | "Practices established"
    | "Not enough information";
  findings: AssessmentFinding[];
  priorities: AssessmentFinding[];
};

export function createReadinessEnquiryDraft(
  result: AssessmentResult,
  assessmentPrice: string,
): string {
  return [
    "IT READINESS SELF-ASSESSMENT · CUSTOMER-SHARED SUMMARY",
    result.score === null
      ? `${result.label}; ${result.unverified} practice(s) could not be verified.`
      : `${result.label}; ${result.score}% across ${result.reviewed} assessed practices; ${result.unverified} unverified.`,
    "",
    "Areas to discuss:",
    ...(result.priorities.length
      ? result.priorities.map(
          (finding) => `- ${finding.topic} (${finding.status}): ${finding.nextStep}`,
        )
      : ["- No improvement area was identified by this self-assessment."]),
    "",
    "This is a browser-generated self-assessment, not a technical audit or verified risk rating.",
    `I would like to discuss the paid initial remote assessment (up to 60 minutes, ${assessmentPrice}). Please send a written scope/quote; do not begin work.`,
  ].join("\n");
}

const SCORE: Record<AssessmentAnswer, number> = {
  unknown: 0,
  no: 0,
  partial: 1,
  yes: 2,
};

export function assessReadiness(answers: AssessmentAnswers): AssessmentResult | null {
  if (ASSESSMENT_QUESTIONS.some((question) => answers[question.id] === undefined)) return null;

  const findings = ASSESSMENT_QUESTIONS.map((question) => {
    const answer = answers[question.id] as AssessmentAnswer;
    return {
      ...question,
      answer,
      status: answer === "unknown" ? "verify" : answer === "yes" ? "maintain" : "improve",
    } satisfies AssessmentFinding;
  });
  const reviewed = findings.filter((finding) => finding.answer !== "unknown").length;
  const unverified = findings.length - reviewed;
  const score =
    reviewed === 0
      ? null
      : Math.round(
          (findings.reduce(
            (total, finding) => total + (finding.answer === "unknown" ? 0 : SCORE[finding.answer]),
            0,
          ) /
            (reviewed * 2)) *
            100,
        );
  const label =
    score === null
      ? "Not enough information"
      : score < 40
        ? "Limited evidence"
        : score < 75
          ? "Practices developing"
          : "Practices established";

  const priorities = findings
    .filter((finding) => finding.status !== "maintain")
    .sort((left, right) => SCORE[left.answer] - SCORE[right.answer])
    .filter(
      (finding, index, all) =>
        all.findIndex((candidate) => candidate.serviceSlug === finding.serviceSlug) === index,
    )
    .slice(0, 3);

  return { score, reviewed, unverified, label, findings, priorities };
}
