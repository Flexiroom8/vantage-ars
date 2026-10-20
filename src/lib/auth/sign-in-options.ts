import { createServerFn } from "@tanstack/react-start";

export type SignInOptions = {
  /** Founder email/password sign-in is available. */
  password: boolean;
  /** Google / X through the Grok broker is available. */
  oauth: boolean;
  /** The one-time founder setup (FOUNDER_SETUP_TOKEN) is still open. */
  setupOpen: boolean;
};

/** What the private door should offer. Reveals no account details. */
export const getSignInOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<SignInOptions> => {
    const [{ oauthEnabled }, { emailAndPasswordEnabled }, { founderSetupOpen }] = await Promise.all(
      [import("./server"), import("./email-password"), import("./founder-setup")],
    );
    let setupOpen = false;
    try {
      setupOpen = emailAndPasswordEnabled && (await founderSetupOpen());
    } catch {
      setupOpen = false;
    }
    return { password: emailAndPasswordEnabled, oauth: oauthEnabled, setupOpen };
  },
);
