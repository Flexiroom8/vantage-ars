import { createFileRoute } from "@tanstack/react-router";
import { nudgeScheduler, reportSiteView } from "@/lib/office/api";

/**
 * Beacon endpoint for real page views.
 *
 * A server route rather than a Nitro handler, because the office store is
 * server-only and the build's import protection keeps `.server` modules out of
 * anything a browser bundle could reach. Going through a server function in
 * `api.ts` is the established path.
 *
 * It always answers 204, whatever happened. A visitor must never learn that
 * their page view failed, and must never wait on it.
 */
export const Route = createFileRoute("/api/site-signal")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          await reportSiteView({
            data: {
              path: typeof body.path === "string" ? body.path : "",
              kind: typeof body.kind === "string" ? body.kind : "page_view",
              referrer: typeof body.referrer === "string" ? body.referrer : undefined,
              country: typeof body.country === "string" ? body.country : undefined,
              agentFamily: typeof body.agentFamily === "string" ? body.agentFamily : undefined,
            },
          });
        } catch {
          // Fall through to 204. Analytics never break a page.
        }
        // A real page view means someone is on the site; if the scheduler has
        // fallen behind, this is a free chance to catch up. The beacon caller
        // never waits on this response, so the tick may use its full budget.
        try {
          await nudgeScheduler({ data: { waitMs: 9_000 } });
        } catch {
          // Analytics never break a page — and never fail on the office either.
        }
        return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
      },
      GET: async () => new Response(null, { status: 405, headers: { allow: "POST" } }),
    },
  },
} as any);
