import { createServerOnlyFn } from "@tanstack/react-start";

export type ResponseCookieOptions = {
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  maxAge?: number;
  domain?: string;
};

/**
 * Server-only bridge to TanStack Start's response cookie store. The dynamic
 * `@tanstack/react-start/server` import lives inside this exempt handler so
 * TanStack route files can reach auth cookie delivery (via gate-session.ts)
 * without tripping the client-bundle import protection. Throws if ever
 * called from the client — all callers run inside the auth request pipeline.
 */
export const writeResponseCookie = createServerOnlyFn(
  async (input: { name: string; value: string; options?: ResponseCookieOptions }): Promise<void> => {
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(input.name, input.value, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      ...input.options,
    });
  },
);
