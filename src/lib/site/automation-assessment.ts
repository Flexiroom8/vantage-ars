export type AutomationAnswer =
  | "daily"
  | "weekly"
  | "rarely"
  | "unknown"
  | "yes"
  | "partly"
  | "no"
  | "structured"
  | "mixed"
  | "unstructured"
  | "known"
  | "some"
  | "low"
  | "moderate"
  | "high"
  | "defined"
  | "unclear";

export type AutomationQuestion = {
  id: string;
  topic: string;
  prompt: string;
  options: { value: AutomationAnswer; label: string }[];
};

export const AUTOMATION_QUESTIONS: AutomationQuestion[] = [
  {
    id: "frequency",
    topic: "Work volume",
    prompt: "How often does the workflow happen?",
    options: [
      { value: "daily", label: "Several times a day" },
      { value: "weekly", label: "At least weekly" },
      { value: "rarely", label: "Occasionally" },
      { value: "unknown", label: "I don't know" },
    ],
  },
  {
    id: "repeatability",
    topic: "Process",
    prompt: "Can someone describe the steps and the expected result?",
    options: [
      { value: "yes", label: "Yes, the steps are consistent" },
      { value: "partly", label: "Partly; people use different approaches" },
      { value: "no", label: "No, it depends on individual judgement" },
      { value: "unknown", label: "I don't know" },
    ],
  },
  {
    id: "inputs",
    topic: "Information",
    prompt: "How usable are the information and records the workflow depends on?",
    options: [
      { value: "structured", label: "Mostly structured and accessible" },
      { value: "mixed", label: "A mix of structured records and documents" },
      { value: "unstructured", label: "Scattered, incomplete or hard to access" },
      { value: "unknown", label: "I don't know" },
    ],
  },
  {
    id: "exceptions",
    topic: "Exceptions",
    prompt: "Are unusual cases and their escalation path understood?",
    options: [
      { value: "known", label: "Yes; exceptions have a clear owner" },
      { value: "some", label: "Some are known, but gaps remain" },
      { value: "unknown", label: "No, or I don't know" },
    ],
  },
  {
    id: "impact",
    topic: "Impact of error",
    prompt: "What could happen if the workflow gets an answer or action wrong?",
    options: [
      { value: "low", label: "Minor, easy-to-correct internal inconvenience" },
      { value: "moderate", label: "Customer, financial or operational impact" },
      { value: "high", label: "Security, legal, safety or serious financial harm" },
    ],
  },
  {
    id: "approval",
    topic: "Human oversight",
    prompt: "Is it clear which actions need a human to review or approve them?",
    options: [
      { value: "defined", label: "Yes; approvals and limits are documented" },
      { value: "unclear", label: "Some checks exist, but ownership is unclear" },
      { value: "no", label: "No; the workflow can act without clear limits" },
    ],
  },
] as const;

export type AutomationQuestionId = (typeof AUTOMATION_QUESTIONS)[number]["id"];
export type AutomationAnswers = Partial<Record<AutomationQuestionId, AutomationAnswer>>;
export type AutomationOutcome = {
  category: "good-candidate" | "guarded-pilot" | "prepare-first";
  title: string;
  summary: string;
  actions: string[];
  serviceSlug: "managed-support" | "cloud-email" | "security";
};

export function assessAutomation(answers: AutomationAnswers): AutomationOutcome | null {
  if (AUTOMATION_QUESTIONS.some((question) => answers[question.id] === undefined)) return null;

  if (answers.impact === "high" || answers.approval === "no") {
    return {
      category: "prepare-first",
      title: "Define controls before automating",
      summary:
        "This workflow may affect security, legal obligations, safety or significant finances, or its human approval limits are not defined. Keep consequential actions human-reviewed until the controls are independently understood.",
      actions: [
        "Name the accountable process owner and document the current steps.",
        "Define prohibited actions, approval thresholds, audit records and a tested stop path.",
        "If useful, begin with read-only summaries or drafts that a person reviews.",
      ],
      serviceSlug: "security",
    };
  }

  const strongCandidate =
    (answers.frequency === "daily" || answers.frequency === "weekly") &&
    answers.repeatability === "yes" &&
    (answers.inputs === "structured" || answers.inputs === "mixed") &&
    answers.exceptions === "known" &&
    answers.impact === "low" &&
    answers.approval === "defined";

  if (strongCandidate) {
    return {
      category: "good-candidate",
      title: "A sensible candidate for a bounded pilot",
      summary:
        "The workflow is repeated, reasonably documented and lower impact, with known exceptions and review limits. That makes it a promising candidate for a narrow, measurable automation pilot — not a case for unrestricted autonomy.",
      actions: [
        "Choose one step and measure its current time, error rate and completion quality.",
        "Start in draft or recommendation mode; compare results with a human baseline.",
        "Expand only after the owner approves the evidence, limits and rollback plan.",
      ],
      serviceSlug: "managed-support",
    };
  }

  return {
    category: "guarded-pilot",
    title: "A guarded pilot may fit after gaps are addressed",
    summary:
      "There may be useful repetitive work here, but at least one input, exception, process or approval is not ready for hands-off execution. A human-in-the-loop pilot can test the opportunity without transferring decision authority.",
    actions: [
      "Map the workflow and collect representative, permissioned examples.",
      "Route uncertain cases and customer-impacting actions to a named reviewer.",
      "Set acceptance checks, access limits, retention rules and a stop condition before testing.",
    ],
    serviceSlug: answers.inputs === "unstructured" ? "cloud-email" : "managed-support",
  };
}
