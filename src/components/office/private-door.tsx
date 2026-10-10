import { Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { WatchtowerMark } from "@/components/brand/mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, GROK_PROVIDERS, signIn, signOut } from "@/lib/auth/client";
import { getSignInOptions, type SignInOptions } from "@/lib/auth/sign-in-options";
import type { AppUser } from "@/lib/auth/use-current-user";
import { COMPANY } from "@/lib/office/company";

type Mode = "sign-in" | "setup";

function errorText(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message) {
    return error.message;
  }
  return fallback;
}

export function PrivateDoor({ user }: { user: AppUser | null }) {
  const [options, setOptions] = useState<SignInOptions | null>(null);
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getSignInOptions()
      .then((value) => {
        if (!live) return;
        setOptions(value);
        if (value.setupOpen) setMode("setup");
      })
      .catch(() => live && setOptions({ password: true, oauth: false, setupOpen: false }));
    return () => {
      live = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "setup") {
        const result = await authClient.signUp.email(
          { email: email.trim(), password, name: COMPANY.authorName },
          { headers: { "x-founder-setup-token": token.trim() } },
        );
        if (result.error) throw result.error;
      } else {
        const result = await authClient.signIn.email({ email: email.trim(), password, rememberMe: true });
        if (result.error) throw result.error;
      }
      window.location.assign("/office");
    } catch (failure) {
      setError(
        errorText(failure, mode === "setup" ? "The founder account could not be created." : "Email or password is wrong."),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <WatchtowerMark className="size-5 text-accent" />
          <span className="font-mono text-xs tracking-[0.22em]">VANTAGE-ARS</span>
        </Link>
        <Link to="/" className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
          Services
        </Link>
      </header>
      <main className="mx-auto max-w-lg px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Private</p>
        <h1 className="mt-4 font-serif text-4xl tracking-[-0.03em]">
          {mode === "setup" ? "Set up the founder account." : "This page is not public."}
        </h1>
        <p className="mt-4 text-sm text-muted">
          {mode === "setup"
            ? "This runs once. Use the founder email and the setup token from the server settings, then remove the token."
            : "Customers use the services page and the service desk. Nothing on this page is part of that site."}
        </p>
        {user ? (
          <div className="mt-8">
            <p className="text-sm text-muted">Signed in as {user.primaryEmail ?? "another account"}. This office is for the founder only.</p>
            <Button type="button" className="mt-4" variant="secondary" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        ) : (
          <div className="mt-8">
            {options?.password !== false ? (
              <form className="grid gap-4" onSubmit={(event) => void submit(event)} noValidate>
                <div className="grid gap-2">
                  <Label htmlFor="door-email">Email</Label>
                  <Input
                    id="door-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="door-password">Password</Label>
                  <Input
                    id="door-password"
                    type="password"
                    autoComplete={mode === "setup" ? "new-password" : "current-password"}
                    minLength={12}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  {mode === "setup" ? <p className="text-xs text-subtle">At least 12 characters.</p> : null}
                </div>
                {mode === "setup" ? (
                  <div className="grid gap-2">
                    <Label htmlFor="door-token">Setup token</Label>
                    <Input
                      id="door-token"
                      type="password"
                      autoComplete="off"
                      required
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                    />
                  </div>
                ) : null}
                {error ? (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" disabled={pending || !email || !password || (mode === "setup" && !token)}>
                  {pending ? "One moment…" : mode === "setup" ? "Create founder account" : "Sign in"}
                </Button>
                {options?.setupOpen ? (
                  <button
                    type="button"
                    className="justify-self-start text-sm text-muted underline underline-offset-4 hover:text-fg"
                    onClick={() => {
                      setError(null);
                      setMode(mode === "setup" ? "sign-in" : "setup");
                    }}
                  >
                    {mode === "setup" ? "I already have the account" : "First time? Set up the founder account"}
                  </button>
                ) : null}
              </form>
            ) : null}
            {options?.oauth ? (
              <div className="mt-8 flex flex-col gap-2 border-t border-border pt-6">
                {GROK_PROVIDERS.map((provider) => (
                  <Button
                    key={provider.providerId}
                    type="button"
                    variant="secondary"
                    onClick={() => signIn(provider.providerId, { callbackURL: "/office" })}
                  >
                    Continue with {provider.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
