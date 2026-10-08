/** Type declarations for the sign-out sequencing helpers. */
export function runPreSignInSignOut(deps: {
  livePreview: boolean;
  hasBearer: boolean;
  requestSignOut: () => unknown;
  clearToken: () => void;
}): Promise<void>;

export function runSignOut(deps: {
  livePreview: boolean;
  hasBearer: boolean;
  requestSignOut: () => Promise<void> | unknown;
  clearToken: () => void;
  redirect: () => void;
}): Promise<void>;
