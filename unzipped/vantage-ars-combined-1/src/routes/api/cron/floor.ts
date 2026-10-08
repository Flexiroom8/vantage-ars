import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { operateFloor } from "@/lib/office/floor.server";

/**
 * Scheduled, draft-only run of the front desk (Reception follow-ups, Marketing organic campaign,
 * Technical procedures). Off unless AUTO_DRAFTS=on. Needs CRON_SECRET (Vercel sends it as a bearer
 * token). It never emails a customer: letters are saved as drafts for the founder to review and send.
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/cron/floor")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (process.env.AUTO_DRAFTS?.trim().toLowerCase() !== "on") {
          return Response.json({ ok: false, reason: "AUTO_DRAFTS is not on." }, { status: 404 });
        }
        if (!authorised(request)) return new Response("Unauthorized", { status: 401 });
        try {
          const result = await operateFloor({ sendMail: false });
          return Response.json({ ok: true, executed: result.executed, briefing: result.briefing });
        } catch {
          return Response.json({ ok: false, reason: "The run failed." }, { status: 500 });
        }
      },
    },
  },
});
