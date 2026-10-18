/**
 * When a public surface may nudge a stale scheduler.
 *
 * Pure policy, so the decision is testable without a database. The nudge
 * itself lives in `kick.server.ts`; this module only answers the question
 * "has the scheduler clearly fallen behind?"
 */

/**
 * Minutes without a tick before a public surface may nudge one. One full
 * cadence window (the advertised schedule is every ten minutes), so a nudge
 * never fires while the timer is merely between two ordinary runs.
 */
export const KICK_AFTER_MINUTES = 10;

/**
 * The scheduler refuses to act after `failureLimit` consecutive failing ticks
 * (its circuit breaker). The nudge mirrors that: an office whose ticks are
 * already failing must not be nudged into trying again from a health poll.
 */
export function shouldKick(
  minutesSinceTick: number | null,
  consecutiveFailures: number,
  failureLimit: number,
): boolean {
  if (consecutiveFailures >= failureLimit) return false;
  return minutesSinceTick === null || minutesSinceTick >= KICK_AFTER_MINUTES;
}
