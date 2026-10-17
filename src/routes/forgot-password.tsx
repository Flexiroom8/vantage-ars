import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/forgot-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : "",
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { email: initialEmail } = Route.useSearch();
  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Please enter the founder email address.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await authClient.requestPasswordReset({
        email: normalized,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (result.error) {
        throw new Error(result.error.message || "Unable to request password reset.");
      }
      setSent(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to request password reset.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 text-fg">
      <section className="glass panel w-full max-w-md p-7 sm:p-9">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
          VANTAGE-ARS � PRIVATE OPERATIONS
        </div>

        <h1 className="mt-4 font-serif text-4xl tracking-tight">
          {sent ? "Reset link sent." : "Reset founder access."}
        </h1>

        {sent ? (
          <>
            <p className="mt-4 text-sm leading-6 text-muted">
              If the founder account exists for this office, a secure password-reset
              link has been sent. Check your inbox and spam folder.
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
                className="border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300"
              >
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email">Founder email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={submitting}
                placeholder="Founder email address"
              />
            </div>

            <Button
              type="submit"
              className="cta w-full justify-center"
              disabled={submitting}
            >
              {submitting ? "Sendink�u���f" : "Send reset link"}
            </Button>

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
