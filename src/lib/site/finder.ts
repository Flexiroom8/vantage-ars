import { guideBySlug } from "./guides";
import { servicePage } from "./services";

export type FinderTopic =
  "phones" | "network" | "servers" | "cloud" | "security" | "backup" | "unsure";

export type FinderImpact = "down" | "degraded" | "planning";
export type FinderHorizon = "one_off" | "ongoing" | "unsure";

export type FinderOption<T extends string> = {
  id: T;
  label: string;
  hint: string;
};

export const FINDER_TOPICS: FinderOption<FinderTopic>[] = [
  {
    id: "phones",
    label: "Phones and calls",
    hint: "Call quality, extensions, trunks, numbers or voicemail",
  },
  {
    id: "network",
    label: "Wi-Fi and network",
    hint: "Drops, slow links, routing, switches or coverage",
  },
  {
    id: "servers",
    label: "Servers and computers",
    hint: "Windows, Linux, file shares, virtual machines or endpoints",
  },
  {
    id: "cloud",
    label: "Microsoft 365 or email",
    hint: "Mail flow, mailboxes, domains, identity or tenant administration",
  },
  {
    id: "security",
    label: "Security and accounts",
    hint: "Administrator access, email authentication, endpoint protection or a baseline review",
  },
  {
    id: "backup",
    label: "Backups and recovery",
    hint: "What is protected, what has been tested and what is missing",
  },
  {
    id: "unsure",
    label: "Not sure where it sits",
    hint: "Describe the symptom and start with the infrastructure line",
  },
];

export const FINDER_IMPACTS: FinderOption<FinderImpact>[] = [
  { id: "down", label: "Stopped now", hint: "Calls, email, access or payments are interrupted" },
  { id: "degraded", label: "Degraded", hint: "It works, but slowly or unreliably" },
  { id: "planning", label: "Planning ahead", hint: "No active fault; you want the setup reviewed" },
];

export const FINDER_HORIZONS: FinderOption<FinderHorizon>[] = [
  { id: "one_off", label: "One-off fix", hint: "Scope a specific problem or change" },
  { id: "ongoing", label: "Ongoing cover", hint: "A monthly plan with remote time and a report" },
  { id: "unsure", label: "Not sure yet", hint: "Show the starting point and the options" },
];

const TOPIC_SERVICE: Record<FinderTopic, string> = {
  phones: "voip",
  network: "networking",
  servers: "it-infrastructure",
  cloud: "cloud-email",
  security: "security",
  backup: "backup-recovery",
  unsure: "it-infrastructure",
};

const TOPIC_GUIDES: Record<FinderTopic, string[]> = {
  phones: ["one-way-audio", "prepare-for-remote-support"],
  network: ["wifi-drops", "prepare-for-remote-support"],
  servers: ["change-without-rollback", "prepare-for-remote-support"],
  cloud: ["change-without-rollback", "prepare-for-remote-support"],
  security: ["change-without-rollback", "backup-is-not-recovery"],
  backup: ["backup-is-not-recovery", "prepare-for-remote-support"],
  unsure: ["prepare-for-remote-support", "backup-is-not-recovery"],
};

const CHECKLIST = [
  "What stopped, and when you first noticed it",
  "What changed just before it started",
  "Who or what is affected, and how many people",
  "Any access limits the engineer must know about",
  "The outcome you want, in your own words",
];

export type FinderRecommendation = {
  primarySlug: string;
  secondarySlug: string | null;
  guideSlugs: string[];
  urgency: "now" | "soon" | "planned";
  headline: string;
  rationale: string;
  checklist: string[];
};

export function recommendService(input: {
  topic: FinderTopic;
  impact: FinderImpact;
  horizon: FinderHorizon;
}): FinderRecommendation {
  const topicSlug = TOPIC_SERVICE[input.topic];
  const topicTitle = servicePage(topicSlug)?.title ?? "the closest service line";
  const primarySlug = input.horizon === "ongoing" ? "managed-support" : topicSlug;
  const secondarySlug =
    input.horizon === "ongoing"
      ? topicSlug === "managed-support"
        ? null
        : topicSlug
      : input.horizon === "unsure" || input.topic === "unsure"
        ? "managed-support"
        : null;

  const primaryTitle = servicePage(primarySlug)?.title ?? "the service desk";
  const urgency =
    input.impact === "down" ? "now" : input.impact === "degraded" ? "soon" : "planned";

  const rationale =
    input.horizon === "ongoing"
      ? `You described an ongoing need. Start with the ${primaryTitle}; it sets out the monthly remote time and the written report. ${topicTitle} explains the work itself${secondarySlug ? `, and the ${servicePage(secondarySlug)?.title ?? "service line"} page is the one-off route` : ""}.`
      : input.topic === "unsure"
        ? `Start with ${primaryTitle}. It is the broadest technical line and the first step is to narrow where the symptom actually sits. The managed support page is the optional ongoing route.`
        : input.impact === "down"
          ? `Start with ${primaryTitle}. Say in the first line that calls, email or access are stopped; the enquiry is read in that order. A written quote still comes before any work.`
          : input.impact === "planning"
            ? `Start with ${primaryTitle}. A written quote can scope the review or change without an emergency call-out. Nothing starts until you accept the scope and price.`
            : `Start with ${primaryTitle}. The page explains what the work covers and the published rates. A written quote is prepared before anything changes.`;

  const guideSlugs = (TOPIC_GUIDES[input.topic] ?? [])
    .filter((slug) => guideBySlug(slug) !== undefined)
    .slice(0, 2);

  return {
    primarySlug,
    secondarySlug,
    guideSlugs,
    urgency,
    headline:
      input.impact === "down"
        ? `Start with ${primaryTitle}, and say it is stopped.`
        : `Start with ${primaryTitle}.`,
    rationale,
    checklist: [...CHECKLIST],
  };
}
