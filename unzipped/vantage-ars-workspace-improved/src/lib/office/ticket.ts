export function nextTicketStatus(
  current: string,
  next: "in_progress" | "resolved",
): { ok: true } | { ok: false; error: string } {
  if (current === "resolved") return { ok: false, error: "This ticket is already resolved." };
  if (next === "in_progress" && current !== "open") {
    return { ok: false, error: "Only an open ticket can be started." };
  }
  if (next === "resolved" && current !== "in_progress") {
    return { ok: false, error: "Start the work before resolving it." };
  }
  return { ok: true };
}
