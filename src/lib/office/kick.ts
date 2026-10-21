/**
 * When a public surface may nudge a stale scheduler.
 *
 * Pure policy, so the decision is testable without a database. The nudge
 * itself lives in `kick.server.ts`; this module only answers the question
 * "has the scheduler clearly fallen behind?"
 */
import { RECOVERY_COOLDOWN_MINUTES, shouldRecoverFromBreaker } from "./autonomy";

/**
 * Minutes without a tick before a public surface may nudge one. One full
 * cadence window (the advertised schedule is every ten minutes), so a nudge
 * never fires while the timer is merely between two ordinary runs.
 */
export const KICK_AFTER_MINUTES = 10;

/**
 * A circuit-broken scheduler is left alone until its cooldown has passed. At
 * that point a single nudge is allowed: the tick probes the database, the
 * chain and the halt state, and either clears the breaker itself or stays put.
 * The nudge is the only way a quiet office can recover without a person.
 */
export function shouldKick(
  minutesSinceTick: number | null,
  consecutiveFailures: number,
  failureLimit: number,
  recoveryCooldownMinutes = RECOVERY_COOLDOWN_MINUTES,
): boolean {
  if (consecutiveFailures >= failureLimit) {
    return shouldRecoverFromBreaker(
      minutesSinceTick,
      consecutiveFailures,
      failureLimit,
      recoveryCooldownMinutes,
    );
  }
  return minutesSinceTick === null || minutesSinceTick >= KICK_AFTER_MINUTES;
}
