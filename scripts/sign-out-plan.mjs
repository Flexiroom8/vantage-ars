/**
 * Sign-out sequencing, shared by the auth client so the order of
 * operations is unit-testable without a browser.
 *
 * Two callers, two guarantees:
 *
 * - `runPreSignInSignOut` (before OAuth starts): clears any prior
 *   local session so switching providers switches identity. Bounded
 *   in the live preview (a hung request must not leave the popup
 *   hanging); unbounded when deployed, because only the server can
 *   end a deployed session — cutting it short would start OAuth with
 *   the old session still live.
 * - `runSignOut`: the deliberate "sign out" action. When deployed it
 *   REJECTS if the server never confirms (the session is an HttpOnly
 *   cookie only the server can clear). In the live preview the local
 *   clear is sufficient, so it always resolves.
 */

/** How long the live preview waits for a server round-trip before proceeding. */
const PREVIEW_TIMEOUT_MS = 1500;

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function validate(deps, required, label) {
  if (!isPlainObject(deps)) throw new TypeError(`${label} must be an object`);
  for (const key of required) {
    if (typeof deps[key] !== "function") {
      throw new TypeError(`${label}.${key} must be a function`);
    }
  }
  if (typeof deps.livePreview !== "boolean") {
    throw new TypeError(`${label}.livePreview must be a boolean`);
  }
  if (typeof deps.hasBearer !== "boolean") {
    throw new TypeError(`${label}.hasBearer must be a boolean`);
  }
}

/** Race a promise against a timeout, resolving to `timedOut` on timeout. */
function bounded(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ timedOut: true }), ms);
    Promise.resolve(promise)
      .then(
        () => resolve({ timedOut: false }),
        () => resolve({ timedOut: false, failed: true }),
      )
      .finally(() => clearTimeout(timer));
  });
}

/**
 * Clear the session before starting sign-in. Never throws: sign-in
 * must proceed even if the prior sign-out could not complete.
 */
export async function runPreSignInSignOut({
  livePreview,
  hasBearer,
  requestSignOut,
  clearToken,
}) {
  validate(
    { livePreview, hasBearer, requestSignOut, clearToken },
    ["requestSignOut", "clearToken"],
    "runPreSignInSignOut",
  );

  if (!hasBearer) {
    // Nothing local to clear. When deployed there may still be a
    // server session; only sign out of it on the real sign-out
    // action, not on every sign-in attempt.
    return;
  }

  if (livePreview) {
    // Bounded: the popup is already open and a hung request must not
    // leave it hanging. Failure is swallowed — the local token clear
    // below is what switches identity in the preview.
    await bounded(requestSignOut(), PREVIEW_TIMEOUT_MS);
  } else {
    // Deployed: let the server finish (or throw) before OAuth starts.
    await requestSignOut();
  }
  clearToken();
}

/**
 * Sign out of the app. Redirects on success.
 *
 * Deployed: rejects when the server does not confirm, because a
 * redirect would otherwise report a sign-out that did not happen.
 * Live preview: the local clear is sufficient, so it always
 * resolves and redirects.
 */
export async function runSignOut({
  livePreview,
  hasBearer,
  requestSignOut,
  clearToken,
  redirect,
}) {
  validate(
    { livePreview, hasBearer, requestSignOut, clearToken, redirect },
    ["requestSignOut", "clearToken", "redirect"],
    "runSignOut",
  );

  if (livePreview) {
    await bounded(requestSignOut(), PREVIEW_TIMEOUT_MS);
    clearToken();
    redirect();
    return;
  }

  // Deployed: must confirm with the server. Propagate the failure so
  // the caller can surface it and let the visitor retry.
  await requestSignOut();
  clearToken();
  redirect();
}
