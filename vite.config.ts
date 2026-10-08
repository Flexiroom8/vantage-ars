import { readFile } from "node:fs/promises";
import { defineConfig } from "vite";
import { tailwindcss } from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

/**
 * Vantage-ARS app config (TanStack Start + Tailwind v4).
 *
 * Two custom plugins:
 *
 *  - `grokOgIdentity`   — serves `virtual:grok-og-identity`, the
 *    OG identity consumed by the deployed-app PWA middleware
 *    (server/middleware/grok-pwa.ts). The identity lives in
 *    src/lib/og/site.json and is baked in at build time.
 *  - `authPopupPlugin`  — serves `GET /auth/popup` during
 *    `npm run dev`. The sandbox live preview must sign in from a
 *    top-level popup (partitioned iframe cookies), so the popup
 *    document is a server handler, not a React route. In
 *    production the Nitro route server/routes/auth/popup.ts
 *    serves the same handler.
 */
function grokOgIdentity(): Plugin {
  const virtualModuleId = "virtual:grok-og-identity";
  const resolvedId = `\0${virtualModuleId}`;
  const siteJson = new URL("./src/lib/og/site.json", import.meta.url);
  return {
    name: "grok-og-identity",
    enforce: "pre",
    resolveId(id) {
      return id === virtualModuleId ? resolvedId : undefined;
    },
    async load(id) {
      if (id !== resolvedId) return undefined;
      const site = JSON.parse(await readFile(siteJson, "utf8"));
      return `export const grokOgIdentity = ${JSON.stringify({ site })};`;
    },
  };
}

function authPopupPlugin(): Plugin {
  return {
    name: "grok-auth-popup",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const host = req.headers.host ?? "localhost:8080";
        const url = new URL(req.url ?? "/", `http://${host}`);
        if (url.pathname !== "/auth/popup") return next();
        try {
          // Load through Vite's SSR pipeline so server-only modules
          // (import.meta.glob, import protections) transform as they
          // do inside the app.
          const { handleAuthPopupRequest } = await server.ssrLoadModule(
            "/src/lib/auth/popup.server.ts",
          );
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            headers.set(key, Array.isArray(value) ? value.join(", ") : value);
          }
          const request = new Request(url.toString(), {
            method: req.method ?? "GET",
            headers,
          });
          const response = await handleAuthPopupRequest(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    grokOgIdentity(),
    authPopupPlugin(),
    tanstackStart(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 8080,
  },
});
