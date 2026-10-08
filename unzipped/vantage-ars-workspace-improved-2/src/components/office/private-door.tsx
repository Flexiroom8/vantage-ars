import { Link } from "@tanstack/react-router";
import { WatchtowerMark } from "@/components/brand/mark";
import { Button } from "@/components/ui/button";
import { GROK_PROVIDERS, signIn, signOut } from "@/lib/auth/client";
import type { AppUser } from "@/lib/auth/use-current-user";

export function PrivateDoor({ user }: { user: AppUser | null }) {
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
      <main className="mx-auto max-w-lg px-4 py-20 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Private</p>
        <h1 className="mt-4 font-serif text-4xl tracking-[-0.03em]">This page is not public.</h1>
        <p className="mt-4 text-sm text-muted">
          Customers use the services page and the service desk. Nothing on this page is part of that site.
        </p>
        {user ? (
          <div className="mt-8">
            <p className="text-sm text-muted">Signed in as {user.primaryEmail ?? "another account"}.</p>
            <Button type="button" className="mt-4" variant="secondary" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-2">
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
        )}
      </main>
    </div>
  );
}
