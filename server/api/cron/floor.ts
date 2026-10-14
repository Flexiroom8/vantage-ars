import { timingSafeEqual } from "node:crypto";
import { defineEventHandler, getHeader, setResponseStatus } from "h3";
import { operateFloor } from "../../../src/lib/office/floor.server";

function authorised(authHeader: string | undefined): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16) return false;
  const given = authHeader ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default defineEventHandler(async (event) => {
  if (process.env.AUTO_DRAFTS?.trim().toLowerCase() !== "on") {
    setResponseStatus(event, 404);
    return { ok: false, reason: "AUTO_DRAFTS is not on." };
  }
  if (!authorised(getHeader(event, "authorization"))) {
    setResponseStatus(event, 401);
    return "Unauthorized";
  }
  try {
    const result = await operateFloor({ sendMail: false });
    return { ok: true, executed: result.executed, briefing: result.briefing };
  } catch {
    setResponseStatus(event, 500);
    return { ok: false, reason: "The run failed." };
  }
});
