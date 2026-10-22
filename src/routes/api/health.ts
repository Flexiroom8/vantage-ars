import { createFileRoute } from "@tanstack/react-router";
import { getOfficeHealthForRequest, nudgeScheduler } from "@/lib/office/api";
import { publicStatus } from "@/lib/office/public-status";

/**
 * Liveness and readiness for the whole office, in one JSON document.
 *
 * Answers "is the business actually running?", not just "is the process up?".
 * Reports the database, the audit chain, the autonomy scheduler, mail delivery,
 * the work queue and the money position — and never returns a secret, a
 * credential, a token or any customer content.
 *
 * Anonymous callers get the public projection: no money, no halt reason, no
 * mail account, no customer counts. A founder session (or the cron secret) gets
 * the full picture. The projection lives in `public-status.ts`, so there is no
 * field to forget to remove here.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const header = request.headers.get("authorization") ?? "";
          const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
          const { full, health } = await getOfficeHealthForRequest({ data: { token } });
          const body = full
            ? health
            : publicStatus({
                checkedAt: health.checkedAt,
                company: health.company,
                version: health.version,
                halted: health.halted,
                database: { ok: health.database.ok },
                chain: { ok: health.chain.ok },
                scheduler: {
                  autonomyEnabled: health.scheduler.autonomyEnabled,
                  overdue: health.scheduler.overdue,
                  consecutiveFailures: health.scheduler.consecutiveFailures,
                },
                rateCard: { ok: health.rateCard.ok },
              });
          // A monitor polling health is also a liveness signal for the
          // scheduler. Keep the public wait tiny so an anonymous flood cannot
          // pin request threads; an authenticated operator may wait for the
          // catch-up tick.
          await nudgeScheduler({ data: { waitMs: full ? 2_000 : 250 } }).catch(() => undefined);
          return Response.json(body, {
            status: body.ok ? 200 : 503,
            headers: {
              "cache-control": "no-store",
              // Never let a search engine index a status document about the office.
              "x-robots-tag": "noindex, nofollow",
              ...(full ? { "x-health-scope": "full" } : { "x-health-scope": "public" }),
            },
          });
        } catch (error) {
          // A monitor must always get a document, never a stack trace or an
          // internal error string.
          console.error("[health] check failed", error);
          return Response.json(
            {
              ok: false,
              checkedAt: new Date().toISOString(),
              company: "Vantage-ARS",
              problems: ["Health check failed."],
            },
            { status: 503, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
} as any);
