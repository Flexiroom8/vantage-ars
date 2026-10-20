/**
 * Node ESM resolver hook for `node --test`.
 *
 * The app is bundled by Vite, which understands the `@/*` alias from
 * tsconfig.json and extensionless relative specifiers. The Node test runner
 * understands neither, so tests fail to resolve imports. This hook teaches
 * Node the same two rules so tests exercise the real modules instead of
 * hand-written stand-ins.
 *
 * Rules applied, in order:
 *   1. `@/x`  ->  <repo>/src/x
 *   2. bare `../x` -> `../x.ts`, `../x.tsx`, `../x/index.ts`, `../x.js` (-> .ts)
 *   3. explicit relative paths pass through untouched
 */
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const SRC = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "src");

const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", ".mts", ".js", ".mjs", ".jsx"];

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Resolve a specifier the way Vite would, or return null to defer to Node. */
function resolveLikeVite(specifier, parentURL) {
  let base;

  if (specifier.startsWith("@/")) {
    base = resolvePath(SRC, specifier.slice(2));
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    if (!parentURL?.startsWith("file:")) return null;
    base = resolvePath(dirname(fileURLToPath(parentURL)), specifier);
  } else {
    return null;
  }

  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = `${base}${suffix}`;
    if (isFile(candidate)) return candidate;
  }

  if (isDirectory(base)) {
    for (const suffix of [".ts", ".tsx", ".js", ".mjs"]) {
      const candidate = `${base}/index${suffix}`;
      if (isFile(candidate)) return candidate;
    }
  }

  // Vite accepts a `./x.js` specifier that actually means `./x.ts`.
  const withoutJs = base.replace(/\.js$/, "");
  if (withoutJs !== base) {
    for (const suffix of [".ts", ".tsx"]) {
      if (isFile(`${withoutJs}${suffix}`)) return `${withoutJs}${suffix}`;
    }
  }

  return null;
}

export function resolve(specifier, context, nextResolve) {
  const resolved = resolveLikeVite(specifier, context.parentURL);
  if (resolved && existsSync(resolved)) {
    return {
      url: pathToFileURL(resolved).href,
      format: resolved.endsWith(".tsx") ? "module" : undefined,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
