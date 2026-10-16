import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 12) return setError("Password must be at least 12 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    if (!token) return setError("This reset link is invalid or incomplete.");
    setSubmitting(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) throw new Error(result.error.message || "Password reset failed.");
      setComplete(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Password reset failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 text-fg">
      <section className="glass panel w-full max-w-md p-7 sm:p-9">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">VANTAGE-ARS · PRIVATE OPERATIONS</div>
        <h1 className="mt-4 font-serif text-4xl tracking-tight">{complete ? "Password updated." : "Choose a new password."}</h1>
        {complete ? (
          <>
            <p className="mt-4 text-sm leading-6 text-muted">Your password has been changed and existing sessions have been revoked.</p>
            <Link to="/login" className="cta mt-7 flex justify-center">Sign in</Link>
          </>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-5">
            {error ? <div role="alert" className="border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div> : null}
            <div className="space-y-2"><Label htmlFor="password">New password</Label><Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} disabled={submitting} /></div>
            <div className="space-y-2"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={12} disabled={submitting} /></div>
            <Button type="submit" className="cta w-full justify-center" disabled={submitting || !token}>{submitting ? "Updating…" : "Update password"}</Button>
            {!token ? <p className="text-sm text-red-300">This reset link does not contain a valid token. Request a new one.</p> : null}
          </form>
        )}
      </section>
    </main>
  );
}
