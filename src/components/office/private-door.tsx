import { Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { WatchtowerMark } from "@/components/brand/mark";
import { LiveField } from "@/components/public/live-field";
import { SignalBars } from "@/components/public/motion-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  authClient,
  GROK_PROVIDERS,
  signOut,
} from "@/lib/auth/client";
import {
  getSignInOptions,
  type SignInOptions,
} from "@/lib/auth/sign-in-options";
import type { AppUser } from "@/lib/auth/use-current-user";
import { COMPANY } from "@/lib/office/company";

type PrivateDoorProps = {
  user?: AppUser | null;
};

export function PrivateDoor({ user }: PrivateDoorProps) {
  const [options, setOptions] = useState<SignInOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [setupMode, setSetupMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [founderToken, setFounderToken] = useState("");

  useEffect(() => {
    let cancelled = false;

    getSignInOptions()
      .then((result) => {
        if (!cancelled) {
          setOptions(result);
          setLoading(false);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load sign-in options.",
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (user) {
      window.location.href = "/office";
    }
  }, [user]);

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (setupMode) {
        if (!founderToken.trim()) {
          throw new Error("Founder setup token is required.");
        }

        const result = await authClient.signUp.email({
          email,
          password,
          name,
          fetchOptions: {
            headers: {
              "x-founder-setup-token": founderToken.trim(),
            },
          },
        });

        if (result.error) {
          throw new Error(
            result.error.message || "Founder account setup failed.",
          );
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        });

        if (result.error) {
          throw new Error(
            result.error.message || "Sign-in failed.",
          );
        }
      }

      window.location.href = "/office";
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Authentication failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOAuth(provider: string) {
    setError("");
    setSubmitting(true);

    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: "/office",
      });

      if (result.error) {
        throw new Error(
          result.error.message || "OAuth sign-in failed.",
        );
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "OAuth sign-in failed.",
      );
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    setSubmitting(true);

    try {
      await signOut();
      window.location.href = "/";
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg text-fg">
        <LiveField />

        <div className="relative z-10 flex items-center gap-3 text-xs font-mono uppercase tracking-[0.22em] text-muted">
          <span className="live-dot" />
          Initialising private operations
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg text-fg">
        <LiveField />

        <div className="relative z-10 w-full max-w-md px-6">
          <div className="glass panel p-8">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <WatchtowerMark className="h-8 w-8" />

                <div>
                  <div className="font-mono text-xs font-semibold tracking-[0.18em]">
                    VANTAGE-ARS
                  </div>

                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                    Private operations
                  </div>
                </div>
              </div>

              <span className="live-dot" />
            </div>

            <h1 className="font-serif text-3xl tracking-tight">
              Session already active.
            </h1>

            <p className="mt-3 text-sm leading-6 text-muted">
              The command centre is already authenticated for this
              session.
            </p>

            <div className="mt-8 flex gap-3">
              <Link
                to="/office"
                className="cta flex-1 justify-center"
              >
                Enter office
              </Link>

              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={handleSignOut}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const providers = GROK_PROVIDERS ?? [];

  return (
    <div className="site relative min-h-dvh overflow-hidden bg-bg text-fg">
      <LiveField />

      <div className="relative z-10 flex min-h-dvh flex-col">
        <div className="border-b border-border/70 bg-bg/70 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 lg:px-8">
            <div className="flex items-center gap-3">
              <span className="live-dot" />

              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                VANTAGE-ARS · PRIVATE OPERATIONS
              </span>
            </div>

            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
              Founder access
            </span>
          </div>
        </div>

        <header className="border-b border-border/60 bg-bg/60 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
            <div className="flex items-center gap-4">
              <WatchtowerMark className="h-10 w-10" />

              <div>
                <div className="font-mono text-sm font-semibold tracking-[0.22em]">
                  VANTAGE-ARS
                </div>

                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  Network operations desk
                </div>
              </div>
            </div>

            <Link
              to="/"
              className="cta-ghost hidden sm:inline-flex"
            >
              Public site
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-5 py-12 lg:px-8">
          <div className="w-full max-w-lg">
            <div className="mb-6 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              <span>00 · Restricted</span>
              <span>vantage-ars.co.za / office</span>
            </div>

            <section className="glass panel overflow-hidden">
              <div className="border-b border-border/60 p-7 sm:p-9">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
                      <span className="live-dot" />
                      Private operations
                    </div>

                    <h1 className="font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
                      {setupMode
                        ? "Set up the founder account."
                        : "Command centre access."}
                    </h1>

                    <p className="mt-4 max-w-md text-sm leading-6 text-muted">
                      {setupMode
                        ? "Create the primary founder identity for the Vantage-ARS operations desk."
                        : "Authenticated access is required before entering the private operations environment."}
                    </p>
                  </div>

                  <SignalBars className="hidden h-10 w-10 shrink-0 text-accent sm:block" />
                </div>
              </div>

              <div className="p-7 sm:p-9">
                {error ? (
                  <div
                    role="alert"
                    className="mb-6 border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300"
                  >
                    {error}
                  </div>
                ) : null}

                <form
                  onSubmit={handleEmailSubmit}
                  className="space-y-5"
                >
                  {setupMode ? (
                    <div className="space-y-2">
                      <Label htmlFor="name">
                        Founder name
                      </Label>

                      <Input
                        id="name"
                        name="name"
                        autoComplete="name"
                        value={name}
                        onChange={(event) =>
                          setName(event.target.value)
                        }
                        required
                        disabled={submitting}
                        placeholder="Founder"
                      />
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email address
                    </Label>

                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      required
                      disabled={submitting}
                      placeholder="founder@vantage-ars.co.za"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">
                      Password
                    </Label>

                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete={
                        setupMode
                          ? "new-password"
                          : "current-password"
                      }
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      required
                      disabled={submitting}
                      placeholder="••••••••••••"
                    />
                  </div>

                  {setupMode ? (
                    <div className="space-y-2">
                      <Label htmlFor="founder-token">
                        Founder setup token
                      </Label>

                      <Input
                        id="founder-token"
                        name="founder-token"
                        type="password"
                        autoComplete="off"
                        value={founderToken}
                        onChange={(event) =>
                          setFounderToken(event.target.value)
                        }
                        required
                        disabled={submitting}
                        placeholder="Enter setup token"
                      />
                    </div>
                  ) : null}

                  <Button
                    type="submit"
                    className="cta w-full justify-center"
                    disabled={submitting}
                  >
                    {submitting
                      ? "Authenticating…"
                      : setupMode
                        ? "Create founder account"
                        : "Enter command centre"}
                  </Button>
                </form>

                {options?.founderSetupAllowed ? (
                  <div className="mt-6 border-t border-border/60 pt-6">
                    <button
                      type="button"
                      className="w-full text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-fg"
                      onClick={() => {
                        setError("");
                        setSetupMode((value) => !value);
                      }}
                    >
                      {setupMode
                        ? "Return to sign in"
                        : "First-time founder setup"}
                    </button>
                  </div>
                ) : null}

                {providers.length > 0 ? (
                  <div className="mt-7 border-t border-border/60 pt-7">
                    <div className="mb-4 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                      Federated access
                    </div>

                    <div className="grid gap-3">
                      {providers.map((provider) => (
                        <Button
                          key={provider.id}
                          type="button"
                          variant="outline"
                          disabled={submitting}
                          onClick={() =>
                            handleOAuth(provider.id)
                          }
                          className="w-full justify-center"
                        >
                          {provider.name ?? provider.id}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <div className="mt-6 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              <span>Authenticated operations only</span>
              <span>No customer data on this screen</span>
            </div>
          </div>
        </main>

        <footer className="border-t border-border/60 bg-bg/60 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted lg:px-8">
            <span>{COMPANY.name}</span>
            <span>Private operations desk</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
