/**
 * The timing policy of the work queue.
 *
 * Three numbers decide how the office's queue behaves, and all three were
 * once written inline in SQL, where a mistake is invisible until an item is
 * abandoned, reclaimed or pruned at the wrong time. They live here instead, in
 * one place, where they can be read and tested.
 *
 * Pure module. No database, no clock, no environment.
 */

/**
 * How long to wait before the next attempt at a failed item.
 *
 * Doubling, from two minutes, and never more than an hour: a duty that is
 * genuinely broken must not be retried forever, and a duty that is merely
 * slow must not be abandoned in a minute. The wait is in minutes of real
 * time, and it is written as minutes so that the unit cannot be lost.
 */
export function retryBackoffMinutes(attempts: number): number {
  const tries = Number.isFinite(attempts) ? Math.max(1, Math.floor(attempts)) : 1;
  return Math.min(60, 2 ** tries);
}

/**
 * How long a claimed item may sit before the office assumes the worker died.
 *
 * The default is thirty minutes. Zero means "use the default" rather than
 * "reclaim immediately", because a worker that is still running is not a
 * worker that died.
 */
export function staleClaimMinutes(staleAfterMinutes = 30): number {
  return Math.max(1, Math.floor(staleAfterMinutes) || 30);
}

/**
 * How long finished work is kept before it is pruned.
 *
 * The default is thirty days. `agent_runs` is the durable history; the work
 * table is a queue, and the queue is not a log.
 */
export function pruneKeepDays(keepDays = 30): number {
  return Math.max(1, Math.floor(keepDays) || 30);
}
