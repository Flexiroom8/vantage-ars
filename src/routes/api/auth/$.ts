import { createFileRoute } from "@tanstack/react-router";

/**
 * Better Auth handler. `@/lib/auth/server` is imported lazily on purpose: this
 * route file is part of the generated client route tree, so a static import
 * would pull the `pg` driver (and its CJS `postgres-bytea` dependency, which
 * touches `Buffer` at module scope) into the browser bundle and kill hydration.
 */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        import("@/lib/auth/server").then((m) => m.auth.handler(request)),
      POST: ({ request }: { request: Request }) =>
        import("@/lib/auth/server").then((m) => m.auth.handler(request)),
    },
  },
} as any);
