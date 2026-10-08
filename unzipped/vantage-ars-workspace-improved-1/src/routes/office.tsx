import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { OfficeProvider } from "@/components/office/office-context";
import { PrivateDoor } from "@/components/office/private-door";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { FOUNDER_EMAIL } from "@/lib/office/founder-gate";
import { getOfficeSnapshot } from "@/lib/office/api";

export const Route = createFileRoute("/office")({
  head: () => ({
    meta: [
      { title: "Sign in · Vantage-ARS" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: () => getOfficeSnapshot(),
  component: OfficeLayout,
  pendingComponent: OfficePending,
});

function OfficeLayout() {
  const access = Route.useLoaderData();
  const router = useRouter();
  const { user, isPending } = useCurrentUserState();
  const founder = user?.primaryEmail?.toLowerCase() === FOUNDER_EMAIL;
  useEffect(() => {
    if (founder && access.locked) void router.invalidate();
  }, [access.locked, founder, router]);

  if (isPending || (founder && access.locked)) return <OfficePending />;
  if (!founder || access.locked) return <PrivateDoor user={user} />;
  return (
    <OfficeProvider snapshot={access.snapshot}>
      <AppShell snapshot={access.snapshot}>
        <Outlet />
      </AppShell>
    </OfficeProvider>
  );
}

function OfficePending() {
  return (
    <div className="min-h-dvh bg-bg p-6">
      <Skeleton className="h-14 w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
