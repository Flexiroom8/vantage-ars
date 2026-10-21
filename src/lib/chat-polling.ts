/**
 * Chat polling that does not lock itself out.
 *
 * The previous implementation polled every 4 seconds, which is 900 requests an
 * hour against a 120/hour limit — so the panel throttled itself after about
 * eight minutes and then showed "too many chat requests" for the rest of the
 * hour, to a visitor who had done nothing wrong.
 *
 * Three rules, in order of how much they matter:
 *   1. **Stay inside the budget.** The interval is chosen from the limit, not
 *      from taste: `limit / hour / 60` gives the maximum safe interval, and the
 *      default leaves headroom for the visitor's own messages.
 *   2. **Stop when nobody is looking.** A hidden tab or a collapsed panel polls
 *      nothing. Most of the rate-limit damage came from panels left open in
 *      background tabs.
 *   3. **Back off when nothing is happening.** An idle thread settles to the
 *      slowest interval, so a conversation that has ended costs almost nothing,
 *      and a live one still feels immediate.
 */
import { useEffect, useRef } from "react";

export const PUBLIC_CHAT_READS_PER_HOUR = 240;
/** 240/hour ÷ 60 minutes = 4/minute. Half that leaves room for sends. */
export const PUBLIC_CHAT_INTERVAL_MS = 30_000;
/** A conversation with no new traffic settles here. */
export const PUBLIC_CHAT_IDLE_INTERVAL_MS = 90_000;

export type PollOptions = {
  /** Only poll while this is true (panel open, thread selected). */
  enabled: boolean;
  intervalMs: number;
  idleIntervalMs?: number;
  /** Returns true when the payload actually changed. */
  pull: () => Promise<boolean>;
  /** Fires when the poll changes. */
  onChange?: () => void;
  onError?: (error: unknown) => void;
};

export function useChatPolling(options: PollOptions): void {
  const { enabled, intervalMs, idleIntervalMs, pull, onChange, onError } = options;
  const pullRef = useRef(pull);
  const changeRef = useRef(onChange);
  const errorRef = useRef(onError);

  useEffect(() => {
    pullRef.current = pull;
    changeRef.current = onChange;
    errorRef.current = onError;
  });

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    let cancelled = false;
    let timer: number | undefined;
    let idleTicks = 0;

    async function once() {
      if (cancelled || document.visibilityState === "hidden") {
        schedule();
        return;
      }
      try {
        const changed = await pullRef.current();
        if (cancelled) return;
        idleTicks = changed ? 0 : idleTicks + 1;
        if (changed) changeRef.current?.();
      } catch (error) {
        if (!cancelled) errorRef.current?.(error);
      }
      schedule();
    }

    function schedule() {
      if (cancelled) return;
      const idle = idleIntervalMs ?? intervalMs;
      // One step down to the idle rate, not straight to it: a conversation that
      // goes quiet should settle, not snap.
      const delay = idleTicks >= 2 ? idle : intervalMs;
      timer = window.setTimeout(() => void once(), delay);
    }

    const onVisible = () => {
      if (document.visibilityState === "visible" && timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
        void once();
      }
    };

    void once();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [enabled, intervalMs, idleIntervalMs]);
}

/**
 * The largest safe polling interval for a per-hour limit, with a safety factor.
 * Exported so the two chat surfaces cannot drift apart again.
 */
export function safeIntervalMs(limitPerHour: number, safetyFactor = 0.5): number {
  const perMinute = Math.max(1, limitPerHour / 60);
  return Math.round(60_000 / perMinute / safetyFactor);
}
