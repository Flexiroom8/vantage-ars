import { createFileRoute } from "@tanstack/react-router";
import { runFloorCron } from "@/lib/office/api";

/**
 * Scheduled, draft-only run of the front desk (Reception follow-ups, Marketing
 * organic campaign, Technical procedures). Off unless AUTO_DRAFTS=on. Needs
 * CRON_SECRET as a bearer token (Vercel cron sends it). It never emails a
 * customer: letters are saved as drafts for the founder to review and send.
 *
 * The heavy lifting lives in `runFloorCron` (a server function, where
 * `.server` imports are allowed); this file only adapts HTTP to that call so
 * the client-bundle import protection stays satisfied.
 */
export const Route = createFileRoute("/api/cron/floor")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const header = request.headers.get("authorization") ?? "";
        const secret = header.startsWith("Bearer ") ? header.slice(7) : "";
        const result = await runFloorCron({ data: { secret } });
        if (!result.ok) {
          if (result.reason === "Unauthorized") return new Response("Unauthorized", { status: 401 });
          const status = result.reason === "AUTO_DRAFTS is not on." ? 404 : 500;
          return Response.json({ ok: false, reason: result.reason ?? "The run failed." }, { status });
        }
        return Response.json({ ok: true, executed: result.executed, briefing: result.briefing });
      },
    },
  },
} as any);
