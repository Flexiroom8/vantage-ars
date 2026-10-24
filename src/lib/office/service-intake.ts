import { SERVICE_PAGES } from "@/lib/site/services";

export type ServiceIntake = {
  serviceLine?: string;
  pbxModel?: string;
  sipProvider?: string;
  routerModel?: string;
  startedAt?: string;
};

type ServiceIntakeResult = { ok: true; summary: string } | { ok: false; error: string };

const OPTIONAL_FIELDS = [
  ["pbxModel", "PBX model", 160],
  ["sipProvider", "SIP provider", 160],
  ["routerModel", "Router model", 160],
  ["startedAt", "When it started", 160],
] as const;

export function formatServiceIntake(input: ServiceIntake): ServiceIntakeResult {
  const service = SERVICE_PAGES.find((page) => page.slug === input.serviceLine);
  if (input.serviceLine && !service) {
    return { ok: false, error: "Choose a service line from the list." };
  }

  const details = service ? [`Service line: ${service.title}`] : [];
  for (const [key, label, maxLength] of OPTIONAL_FIELDS) {
    if (key === "pbxModel" || key === "sipProvider") {
      if (service?.slug !== "voip") continue;
    } else if (key === "routerModel" && service?.slug !== "networking") {
      continue;
    }
    const value = input[key];
    if (value === undefined || value === "") continue;
    if (typeof value !== "string" || value.length > maxLength) {
      return { ok: false, error: `${label} must be ${maxLength} characters or fewer.` };
    }
    const normalized = value.replace(/[\r\n]+/g, " ").trim();
    if (normalized) details.push(`${label}: ${normalized}`);
  }

  return { ok: true, summary: details.join("\n") };
}
