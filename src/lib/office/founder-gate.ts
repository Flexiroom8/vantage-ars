import { createMiddleware } from "@tanstack/react-start";
import { COMPANY } from "./company";

export const FOUNDER_EMAIL = COMPANY.email.toLowerCase();

/**
 * The one email that opens the office. Server settings may override the
 * published address with FOUNDER_EMAIL (server-side only).
 */
export function founderEmail(): string {
  const configured = typeof process !== "undefined" ? process.env.FOUNDER_EMAIL?.trim() : undefined;
  return (configured || COMPANY.email).toLowerCase();
}

async function founderFromToken(bearerToken: string | undefined): Promise<boolean> {
  const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  assertSameSiteRequest();
  const user = await getSessionUser(bearerToken);
  return Boolean(user?.email && user.email.toLowerCase() === founderEmail());
}

function tokenFrom(context: { bearerToken?: string }): string | undefined {
  return context.bearerToken;
}

/** Lets the office page render a locked door instead of private records. */
export const officeAccessMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const founder = await founderFromToken(tokenFrom(context));
    return next({ context: { founder } });
  });

/** Rejects every office action that is not the founder. */
export const founderMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const founder = await founderFromToken(tokenFrom(context));
    if (!founder) {
      const { UnauthorizedError } = await import("@/lib/auth/verify.server");
      throw new UnauthorizedError();
    }
    return next({ context: { founder: true as const } });
  });
