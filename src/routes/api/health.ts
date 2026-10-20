import { createFileRoute } from "@tanstack/react-router";
import { getOfficeHealth, nudgeScheduler } from "@/lib/office/api";

/**
 * Liveness and readiness for the whole office, in one JSON document.
 *
 * Answers "is the business actually running?", not just "is the process up?".
 * Reports the database, the audit chain, the autonomy scheduler, mail delivery,
 * the work queue and the money position — and never returns a secret, a
 * credential, a token or any customer content.
 *
 * Unauthenticated callers get the coarse view. Signing in upgrades it to the
 * full picture; that check happens inside `getOfficeHealth`, not here, so the
 * route stays free of server-only imports and the client bundle stays clean.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const health = await getOfficeHealth();
          // A monitor polling health is also a liveness signal for the
          // scheduler: on free hosting tiers the timer throttles, so this hit
          // may start a catch-up tick. Bounded so a monitor's request always
          // answers, and it can never fail the health document.
          await nudgeScheduler({ data: { waitMs: 2_000 } }).catch(() => undefined);
          return Response.json(health, {
            status: health.ok ? 200 : 503,
            headers: {
              "cache-control": "no-store",
              // Never let a search engine index a status document about the office.
              "x-robots-tag": "noindex, nofollow",
            },
          });
        } catch (error) {
          // A monitor must always get a document, never a stack trace.
          return Response.json(
            {
              ok: false,
              checkedAt: new Date().toISOString(),
              company: "Vantage-ARS",
              problems: [error instanceof Error ? error.message : "Health check failed."],
            },
            { status: 503, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
} as any);
