/**
 * Site signal beacon.
 *
 * Records that a real person (or a real crawler) reached a public page, so
 * SIGNAL has something true to work from instead of guessing which pages matter.
 * It reports only what the request itself already contained — path, referrer,
 * country, browser hints — and nothing invented.
 *
 * Three rules:
 *   1. It is fire-and-forget. A failure here must never affect the page.
 *   2. It never blocks the main thread or delays navigation.
 *   3. It records nothing about the visitor themselves: no fingerprint, no
 *      identity, no cross-site tracking. That is a POPIA position, not a
 *      preference, and it keeps the office out of the cookie-consent argument.
 */
import { useEffect } from "react";

import { isTrackedPage } from "./tracked";

export { TRACKED_PATHS, isTrackedPage } from "./tracked";

const ENDPOINT = "/api/site-signal";
const MAX_KIND = 40;
const MAX_VALUE = 300;

function clamp(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function post(payload: Record<string, string>): void {
  try {
    const body = JSON.stringify(payload);
    // sendBeacon survives page unload, which is exactly when a reader navigates
    // away after reading the rates page.
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => undefined);
  } catch {
    // Analytics must never break the site.
  }
}

function countryHint(): string {
  if (typeof document === "undefined") return "";
  // The edge (Cloudflare/Vercel) supplies the authoritative country in a
  // request header; the server prefers that. This is only a hint.
  return clamp(document.documentElement.lang === "en-ZA" ? "ZA" : "", 8);
}

/** Report one page view. Safe to call directly in tests. */
export function reportPageView(path: string, kind = "page_view"): void {
  if (typeof window === "undefined") return;
  const normalised = path.split("?")[0].split("#")[0] || "/";
  if (!isTrackedPage(normalised)) return;
  if (typeof document !== "undefined") {
    const visibility = document.visibilityState as string;
    // A prerendered/hidden document is not a read.
    if (visibility === "prerender" || visibility === "hidden") return;
  }
  post({
    path: normalised,
    kind: clamp(kind, MAX_KIND),
    referrer: clamp(document.referrer, MAX_VALUE),
    country: countryHint(),
    agentFamily: clamp(navigator.userAgent, MAX_VALUE),
  });
}

/**
 * Mount once on the public site. Uses the router's own location so single-page
 * navigations are recorded too, not just hard loads.
 */
export function useSiteSignals(pathname: string | undefined): void {
  useEffect(() => {
    if (!pathname) return;
    reportPageView(pathname);
  }, [pathname]);
}