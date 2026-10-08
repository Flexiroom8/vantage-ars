import { createFileRoute } from "@tanstack/react-router";
import { PrivateDoor } from "@/components/office/private-door";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <div className="min-h-dvh bg-bg" />;
  return <PrivateDoor user={user} />;
}
