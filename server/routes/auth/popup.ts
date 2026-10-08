/**
 * Production (Nitro) route for the live-preview sign-in popup.
 * Mirrors the dev-only Vite middleware (authPopupPlugin in
 * vite.config.ts): the sandbox preview signs in from a top-level
 * popup because iframe cookies are partitioned. The handler is
 * the same server-only function either way.
 */
import { handleAuthPopupRequest } from "../../../src/lib/auth/popup.server";

export async function GET(request: Request): Promise<Response> {
  return handleAuthPopupRequest(request);
}
