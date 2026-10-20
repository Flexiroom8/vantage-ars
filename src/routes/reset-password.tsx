import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { MIN_FOUNDER_PASSWORD, passwordProblem } from "@/lib/auth/founder-password";

function messageOf(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return fallback;
}

/** Better Auth may resolve `{ data, error }` or reject with a bare APIError. */
function authFailure(result: unknown): unknown {
  if (result instanceof Error) return result;
  if (result && typeof result === "object" && "error" in result) {
    const error = (result as { error: unknown }).error;
    if (error) return error;
  }
  return null;
}

export const Route = createFileRoute("/reset-password")({
  // Optional so a reset link that carries only a token (or only an error) is
  // served directly rather than redirected to normalise its search params.
  validateSearch: (search: Record<string, unknown>): { token?: string; error?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Choose a new password · Vantage-ARS" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token = "", error: linkError } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is invalid or incomplete. Request a new one.");
      return;
    }
    const problem = passwordProblem(password, confirm);
    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      const failure = authFailure(result);
      if (failure) {
        throw new Error(messageOf(failure, "Could not update the password."));
      }
      setComplete(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 text-fg">
      <section className="glass panel w-full max-w-md p-7 sm:p-9">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
          VANTAGE-ARS · PRIVATE OPERATIONS
        </div>

        <h1 className="mt-4 font-serif text-4xl tracking-tight">
          {complete ? "Password updated." : "Choose a new password."}
        </h1>

        {complete ? (
          <>
            <p className="mt-4 text-sm leading-6 text-muted">
              Your password has been changed and every existing session has been revoked. Sign in
              with the new password.
            </p>
            <Link to="/login" className="cta mt-7 flex justify-center">
              Sign in
            </Link>
          </>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-5">
            {linkError ? (
              <div
                role="alert"
                className="border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
              >
                {linkError}
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
              >
                {error}
              </div>
            ) : null}

            {!token ? (
              <div
                role="status"
                className="border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-warn"
              >
                This reset link does not carry a token. It may have expired or already been used.{" "}
                <Link
                  to="/forgot-password"
                  search={{ email: "" }}
                  className="underline underline-offset-2"
                >
                  Request a new link
                </Link>
                .
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={MIN_FOUNDER_PASSWORD}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
                minLength={MIN_FOUNDER_PASSWORD}
                disabled={submitting}
              />
            </div>

            <Button
              type="submit"
              className="cta w-full justify-center"
              disabled={submitting || !token}
            >
              {submitting ? "Updating…" : "Update password"}
            </Button>

            <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              At least {MIN_FOUNDER_PASSWORD} characters · sessions revoked
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
