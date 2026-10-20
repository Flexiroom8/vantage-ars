/**
 * Small, dependency-free helpers for public-facing endpoints.
 * Pure so they can be unit tested without the app runtime.
 */

/** Coerce untrusted input to a string. Non-strings become "" instead of throwing. */
export function str(value: unknown, max = 5000): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/**
 * Pick the caller address. Prefer headers the edge sets itself
 * (cf-connecting-ip, x-real-ip). x-forwarded-for is client-appendable, so only
 * its LAST hop is used as a fallback; the first entry can be spoofed.
 */
export function clientKey(headers: { get(name: string): string | null } | undefined): string {
  if (!headers) return "local";
  const edge = headers.get("cf-connecting-ip")?.trim() || headers.get("x-real-ip")?.trim();
  if (edge) return edge.slice(0, 64);
  const hops =
    headers
      .get("x-forwarded-for")
      ?.split(",")
      .map((hop) => hop.trim())
      .filter(Boolean) ?? [];
  return (hops[hops.length - 1] ?? "local").slice(0, 64);
}

export type RateLimiter = { allow(key: string, now?: number): boolean; size(): number };

/** Sliding-window limiter that prunes idle keys so the map cannot grow without bound. */
export function createRateLimiter(limit: number, windowMs: number, maxKeys = 5000): RateLimiter {
  const hits = new Map<string, number[]>();

  function prune(now: number) {
    for (const [key, stamps] of hits) {
      const live = stamps.filter((stamp) => now - stamp < windowMs);
      if (live.length === 0) hits.delete(key);
      else if (live.length !== stamps.length) hits.set(key, live);
    }
  }

  return {
    allow(key, now = Date.now()) {
      if (hits.size >= maxKeys) prune(now);
      if (hits.size >= maxKeys) return false; // under flood, refuse new keys rather than grow
      const live = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
      if (live.length >= limit) {
        hits.set(key, live);
        return false;
      }
      live.push(now);
      hits.set(key, live);
      return true;
    },
    size: () => hits.size,
  };
}

export const EMAIL_PATTERN = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

export function validEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}
