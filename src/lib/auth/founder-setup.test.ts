import { betterAuth } from "better-auth";
import { bearer, genericOAuth } from "better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";

import { ensureDbReady, getPglite } from "../db";
import { emailAndPasswordEnabled } from "./email-password";
import { checkFounderPasswordReset, checkFounderSignUp, FOUNDER_SETUP_HEADER } from "./founder-setup";
import { GATE_PROVIDER_ID, gateIdentitySessions } from "./gate-session";
import { GROK_PROVIDERS } from "./providers";
import { pgliteDialect } from "./pglite-dialect";
import {
  GROK_ISSUER_DEFAULT,
  PREVIEW_ALLOWED_HOSTS,
  PREVIEW_CLIENT_ID,
  PREVIEW_CLIENT_SECRET,
} from "./preview";

/**
 * Make sure the local database layer has been initialized.
 */
void ensureDbReady();

/**
 * ---------------------------------------------------------------------------
 * Preview authentication secret
 * ---------------------------------------------------------------------------
 *
 * Used only as a fallback when BETTER_AUTH_SECRET is not configured.
 *
 * Production should use the Vercel BETTER_AUTH_SECRET environment variable.
 */
const globalAuthRef = globalThis as typeof globalThis & {
  __grokAuthPreviewSecret__?: string;
};

function previewAuthSecret(): string {
  globalAuthRef.__grokAuthPreviewSecret__ ??= randomBytes(32).toString("hex");

  return globalAuthRef.__grokAuthPreviewSecret__;
}

/**
 * ---------------------------------------------------------------------------
 * Environment helper
 * ---------------------------------------------------------------------------
 */
const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();

  return value ? value : undefined;
};

/**
 * ---------------------------------------------------------------------------
 * Authentication feature configuration
 * ---------------------------------------------------------------------------
 */
const authDisabled = env("VITE_AUTH_ENABLED") === "false";

const grokIssuer =
  env("GROK_AUTH_ISSUER") ?? GROK_ISSUER_DEFAULT;

const grokClientId =
  env("GROK_AUTH_CLIENT_ID") ?? PREVIEW_CLIENT_ID;

const grokClientSecret =
  env("GROK_AUTH_CLIENT_SECRET") ?? PREVIEW_CLIENT_SECRET;

export const authConfigured =
  !authDisabled &&
  (emailAndPasswordEnabled ||
    Boolean(grokClientId && grokClientSecret));

/**
 * ---------------------------------------------------------------------------
 * Better Auth base URL
 * ---------------------------------------------------------------------------
 *
 * BETTER_AUTH_URL may be supplied through Vercel environment variables.
 *
 * If it is not supplied, production defaults to:
 *
 *   https://www.vantage-ars.co.za
 *
 * The application also supports:
 *
 *   https://vantage-ars.co.za
 *   https://www.vantage-ars.co.za
 *   https://vercel.vantage-ars.co.za
 */
const explicitBaseURL = env("BETTER_AUTH_URL");

/**
 * ---------------------------------------------------------------------------
 * Preview / local hosts
 * ---------------------------------------------------------------------------
 */
const previewAllowedHosts: string[] = [
  ...PREVIEW_ALLOWED_HOSTS,
];

const LOCAL_DEV_ORIGINS: string[] = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
];

/**
 * ---------------------------------------------------------------------------
 * Vantage-ARS production origins
 * ---------------------------------------------------------------------------
 *
 * These MUST remain trusted even when BETTER_AUTH_URL is configured.
 *
 * This is the important fix for the "Invalid origin" error.
 */
const PRODUCTION_ORIGINS: string[] = [
  "https://vantage-ars.co.za",
  "https://www.vantage-ars.co.za",
  "https://vercel.vantage-ars.co.za",
];

/**
 * ---------------------------------------------------------------------------
 * Better Auth base URL configuration
 * ---------------------------------------------------------------------------
 *
 * allowedHosts protects the application from accepting arbitrary hosts while
 * still allowing the actual Vantage-ARS production domains.
 */
const baseURL =
  explicitBaseURL ??
  {
    allowedHosts: [
      ...previewAllowedHosts,

      "localhost",
      "127.0.0.1",
      "[::1]",

      "vantage-ars.co.za",
      "www.vantage-ars.co.za",
      "vercel.vantage-ars.co.za",
    ],

    protocol: "auto" as const,

    fallback: "https://www.vantage-ars.co.za",
  };

/**
 * ---------------------------------------------------------------------------
 * Better Auth trusted origins
 * ---------------------------------------------------------------------------
 *
 * CRITICAL:
 *
 * Previously, when BETTER_AUTH_URL existed, the application effectively
 * trusted only BETTER_AUTH_URL plus local development origins.
 *
 * That meant the browser could reach:
 *
 *   https://www.vantage-ars.co.za
 *
 * while Better Auth rejected the request because that origin was not in
 * trustedOrigins.
 *
 * We now explicitly trust all supported Vantage-ARS production origins.
 *
 * Set is used to prevent duplicate origins if BETTER_AUTH_URL itself is one
 * of the production domains.
 */
const trustedOrigins: string[] = explicitBaseURL
  ? [
      ...new Set([
        explicitBaseURL,

        ...PRODUCTION_ORIGINS,

        ...LOCAL_DEV_ORIGINS,
      ]),
    ]
  : [
      ...previewAllowedHosts,

      ...previewAllowedHosts.flatMap((host) => [
        `https://${host}`,
        `http://${host}`,
      ]),

      ...PRODUCTION_ORIGINS,

      ...LOCAL_DEV_ORIGINS,
    ];

/**
 * ---------------------------------------------------------------------------
 * Database
 * ---------------------------------------------------------------------------
 */
const databaseUrl = env("DATABASE_URL");

const database = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
    })
  : {
      dialect: pgliteDialect(() => getPglite()),
      type: "postgres" as const,
    };

/**
 * ---------------------------------------------------------------------------
 * Session cookie
 * ---------------------------------------------------------------------------
 */
export const SESSION_TOKEN_COOKIE =
  "__Host-grok-auth.session_token";

/**
 * ---------------------------------------------------------------------------
 * Grok OAuth
 * ---------------------------------------------------------------------------
 */
const grokOAuthWanted =
  env("GROK_OAUTH") !== "off" &&
  (Boolean(env("GROK_AUTH_CLIENT_ID")) ||
    !explicitBaseURL);

const issuerBase =
  grokIssuer.replace(/\/+$/, "");

const grokAuthorizationUrl =
  `${issuerBase}/api/auth/oauth2/authorize`;

const grokTokenUrl =
  `${issuerBase}/api/auth/oauth2/token`;

const grokUserInfoUrl =
  `${issuerBase}/api/auth/oauth2/userinfo`;

const grokOAuthPlugin =
  authConfigured &&
  grokOAuthWanted &&
  grokClientId &&
  grokClientSecret
    ? genericOAuth({
        config: GROK_PROVIDERS.map(
          ({ providerId, idp }) => ({
            providerId,

            clientId:
              grokClientId as string,

            clientSecret:
              grokClientSecret as string,

            authorizationUrl:
              grokAuthorizationUrl,

            tokenUrl:
              grokTokenUrl,

            userInfoUrl:
              grokUserInfoUrl,

            scopes: [
              "openid",
              "profile",
              "email",
            ],

            authorizationUrlParams: {
              idp,
              prompt: "login",
            },
          }),
        ),
      })
    : null;

/**
 * ---------------------------------------------------------------------------
 * Better Auth
 * ---------------------------------------------------------------------------
 */
export const auth = betterAuth({
  /**
   * Base URL / host configuration.
   */
  baseURL,

  /**
   * Production secret comes from Vercel.
   *
   * Never hard-code this value into GitHub.
   */
  secret:
    env("BETTER_AUTH_SECRET") ??
    previewAuthSecret(),

  /**
   * Database.
   */
  database,

  /**
   * IMPORTANT:
   *
   * These origins are now explicitly trusted.
   */
  trustedOrigins,

  /**
   * Account configuration.
   */
  account: {
    encryptOAuthTokens: true,

    accountLinking: {
      enabled: true,

      trustedProviders: [
        ...GROK_PROVIDERS.map(
          (provider) => provider.providerId,
        ),

        GATE_PROVIDER_ID,
      ],

      requireLocalEmailVerified: false,
    },
  },

  /**
   * Session configuration.
   */
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 300,
    },
  },

  /**
   * Email/password authentication.
   */
  ...(emailAndPasswordEnabled
    ? {
        emailAndPassword: {
          enabled: true,

          minPasswordLength: 12,

          maxPasswordLength: 256,

          autoSignIn: true,

          resetPasswordTokenExpiresIn: 3600,

          revokeSessionsOnPasswordReset: true,

          sendResetPassword: async ({ user, url }) => {
            const { sendCustomerMail } = await import("../office/smtp.server");
            await sendCustomerMail(
              user.email,
              "VANTAGE-ARS password reset",
              `A password reset was requested for your VANTAGE-ARS account.\n\nUse this secure link to choose a new password:\n\n${url}\n\nThis link expires in 60 minutes.\n\nIf you did not request this change, you can ignore this message.`,
            );
          },
        },
      }
    : {}),

  /**
   * -------------------------------------------------------------------------
   * Authentication hooks
   * -------------------------------------------------------------------------
   *
   * Founder signup remains protected by the existing founder setup
   * mechanism.
   */
  hooks: {
    before: createAuthMiddleware(
      async (ctx) => {
        if (ctx.path === "/request-password-reset") {
          const { checkFounderPasswordReset } = await import("./founder-setup");
          const body = (ctx.body ?? {}) as {
            email?: unknown;
          };

          const verdict = await checkFounderPasswordReset(body.email);
          if (!verdict.ok) {
            throw new APIError("FORBIDDEN", {
              message: verdict.error,
            });
          }
          return;
        }

        if (ctx.path !== "/sign-up/email") {
          return;
        }

        const body = (ctx.body ?? {}) as {
          email?: unknown;
        };

        const verdict = await checkFounderSignUp(
          body.email,
          ctx.headers?.get(FOUNDER_SETUP_HEADER),
        );

        if (!verdict.ok) {
          throw new APIError("FORBIDDEN", {
            message: verdict.error,
          });
        }
      },
    ),
  },

  /**
   * -------------------------------------------------------------------------
   * Rate limiting
   * -------------------------------------------------------------------------
   */
  rateLimit: {
    enabled: true,

    window: 60,

    max: 100,

    customRules: {
      "/sign-in/email": {
        window: 300,
        max: 8,
      },

      "/sign-up/email": {
        window: 3600,
        max: 5,
      },

      "/request-password-reset": {
        window: 3600,
        max: 5,
      },
    },
  },

  /**
   * -------------------------------------------------------------------------
   * Security / request handling
   * -------------------------------------------------------------------------
   */
  advanced: {
    ipAddress: {
      ipAddressHeaders: [
        "x-vercel-forwarded-for",
        "cf-connecting-ip",
        "x-real-ip",
        "x-forwarded-for",
      ],
    },

    useSecureCookies: false,

    defaultCookieAttributes: {
      secure: true,

      sameSite: "lax",

      path: "/",
    },

    cookies: {
      session_token: {
        name:
          SESSION_TOKEN_COOKIE,
      },

      session_data: {
        name:
          "__Host-grok-auth.session_data",
      },

      account_data: {
        name:
          "__Host-grok-auth.account_data",
      },

      dont_remember: {
        name:
          "__Host-grok-auth.dont_remember",
      },
    },
  },

  /**
   * -------------------------------------------------------------------------
   * Plugins
   * -------------------------------------------------------------------------
   */
  plugins: [
    gateIdentitySessions(),

    ...(grokOAuthPlugin
      ? [grokOAuthPlugin]
      : []),

    bearer(),

    tanstackStartCookies(),
  ],
});

/**
 * Whether Grok OAuth is currently configured.
 */
export const oauthEnabled =
  Boolean(grokOAuthPlugin);

/**
 * Re-export providers for existing application consumers.
 */
export {
  GROK_PROVIDERS,
} from "./providers";
