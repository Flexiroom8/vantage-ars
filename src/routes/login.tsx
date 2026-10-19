import { createFileRoute } from "@tanstack/react-router";
import { PrivateDoor } from "@/components/office/private-door";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Command centre access · Vantage-ARS" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending)
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <p className="animate-pulse text-sm text-muted">Signing in…</p>
      </div>
    );
  return <PrivateDoor user={user} />;
}
