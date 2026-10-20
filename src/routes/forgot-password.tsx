import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { MIN_FOUNDER_PASSWORD } from "@/lib/auth/founder-password";

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

export const Route = createFileRoute("/forgot-password")({
  // Optional, so a bare `/forgot-password` renders directly instead of costing
  // a 307 redirect just to attach an empty search param.
  validateSearch: (search: Record<string, unknown>): { email?: string } => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Reset founder access · Vantage-ARS" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { email: initialEmail } = Route.useSearch();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Enter the founder email address.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await authClient.requestPasswordReset({
        email: normalized,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      const failure = authFailure(result);
      if (failure) {
        throw new Error(messageOf(failure, "Could not request a password reset."));
      }
      setSent(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not request a password reset. Try again shortly.",
      );
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
          {sent ? "Check your inbox." : "Reset founder access."}
        </h1>

        {sent ? (
          <>
            <p className="mt-4 text-sm leading-6 text-muted">
              If this office has a founder account for that address, a reset link is on its way. It
              expires in one hour and can be used once. Nothing is disclosed about whether the
              address exists.
            </p>
            <Link to="/login" className="cta mt-7 flex justify-center">
              Return to sign in
            </Link>
          </>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-5">
            {error ? (
              <div
                role="alert"
                className="border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
              >
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email">Founder email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={submitting}
                placeholder="founder@vantage-ars.co.za"
              />
            </div>

            <Button type="submit" className="cta w-full justify-center" disabled={submitting}>
              {submitting ? "Sending…" : "Send reset link"}
            </Button>

            <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Minimum {MIN_FOUNDER_PASSWORD} characters
            </p>

            <Link
              to="/login"
              className="block text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted hover:text-fg"
            >
              Return to sign in
            </Link>
          </form>
        )}
      </section>
    </main>
  );
}
