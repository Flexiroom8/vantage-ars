export type DiagnosticChecklist = {
  label: string;
  checks: string[];
};

/**
 * A bounded, customer-led checklist for an accepted troubleshooting scope.
 * It asks for observations only; it never instructs customers to scan, change,
 * restart, or expose access to their systems.
 */
export function diagnosticChecklistForQuote(input: {
  rateId?: string | null;
  title: string;
  scope?: string | null;
}): DiagnosticChecklist | null {
  const text = `${input.title} ${input.scope ?? ""}`.toLowerCase();
  const diagnosticIntent =
    /\b(fault|issue|diagnos(?:e|is|tic|ed)?|error|down|outage|drops?|not working|can't|won't)\b/.test(
      text,
    );

  if (
    input.rateId === "voip-diagnosis" ||
    (diagnosticIntent && /\b(voip|pbx|sip|phone|handset|extension)\b/.test(text))
  ) {
    return {
      label: "Phone and call checks",
      checks: [
        "Tell us whether one handset or extension is affected, or several.",
        "For a recent failed call, note the time and whether audio failed one way or both. Do not share call recordings or private conversation content.",
        "Write down any status light or error shown on the affected handset or softphone.",
      ],
    };
  }

  if (
    diagnosticIntent &&
    /\b(wifi|wi-fi|wireless|router|switch|network|ethernet|cable|vlan)\b/.test(text)
  ) {
    return {
      label: "Network and Wi-Fi checks",
      checks: [
        "Tell us which device or area is affected, and whether nearby devices still work.",
        "If available, check ordinary internet access from a second device and report only whether it works.",
        "Note visible router, switch, or access-point status lights. Do not unplug equipment, press reset, or change settings.",
      ],
    };
  }

  if (
    input.rateId === "infra-assessment" ||
    (diagnosticIntent &&
      /\b(server|infrastructure|workstation|computer|endpoint|backup)\b/.test(text))
  ) {
    return {
      label: "IT system checks",
      checks: [
        "Name the affected service or device and when the issue began.",
        "Copy the exact visible error text, removing names, email addresses, customer data, and any access tokens.",
        "Tell us whether another authorised user sees the same issue. Do not restart systems or change configuration.",
      ],
    };
  }

  return null;
}
