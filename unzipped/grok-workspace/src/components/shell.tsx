import { useEffect } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { DecisionSheet } from "@/components/decision-sheet";
import { useAegis } from "@/lib/aegis/store";
import { formatClock } from "@/lib/utils";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Command" },
  { to: "/constitution", label: "Canon" },
  { to: "/fleet", label: "Fleet" },
  { to: "/ledger", label: "Ledger" },
  { to: "/range", label: "Range" },
] as const;

export function SimulationBoot() {
  const hydrate = useAegis((s) => s.hydrate);
  const tick = useAegis((s) => s.tick);
  const paused = useAegis((s) => s.paused);
  const live = useAegis((s) => s.live);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!live || paused) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      tick();
    }, 2600);
    return () => window.clearInterval(id);
  }, [live, paused, tick]);

  return null;
}

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const paused = useAegis((s) => s.paused);
  const simTime = useAegis((s) => s.simTime);
  const day = useAegis((s) => s.health.dayOfAutonomy);
  const halt = useAegis((s) => s.halt);
  const resume = useAegis((s) => s.resume);

  return (
    <TooltipProvider delayDuration={200}>
      <SimulationBoot />
      <div className="relative flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 md:px-6">
            <Link to="/" className="shrink-0">
              <span className="font-display text-xl tracking-tight text-foreground">Aegis</span>
              <span className="mt-0.5 hidden text-[0.625rem] tracking-[0.18em] text-subtle uppercase sm:block">
                Constitutional runtime
              </span>
            </Link>

            <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
              {NAV.map((item) => {
                const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "rounded-sm px-3 py-2 text-sm transition-colors duration-150",
                      active ? "bg-raised text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="flex items-center justify-end gap-2">
                  <span className={cn("size-1.5 rounded-full bg-ok", !paused && "live-dot")} />
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {formatClock(simTime)} UTC
                  </span>
                </div>
                <p className="text-[0.625rem] tracking-wider text-subtle uppercase">Day {day} · A3</p>
              </div>
              {paused ? (
                <Button size="sm" onClick={resume}>
                  Resume
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={halt}>
                  Halt
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 md:px-6 md:pb-10">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
          <div className="grid grid-cols-5">
            {NAV.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex h-14 items-center justify-center text-xs",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {paused ? (
          <div className="pointer-events-none fixed inset-0 z-30 flex items-end justify-center p-6 md:items-center">
            <div className="pointer-events-auto max-w-md rounded-xl bg-card px-6 py-5 shadow-[var(--shadow-lift)]">
              <p className="text-xs tracking-[0.16em] text-subtle uppercase">ART-10</p>
              <h2 className="font-display mt-2 text-3xl text-foreground">Halted.</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The system does not resist shutdown. Fleet paused. Ledger frozen. Resume when you are ready.
              </p>
              <Button className="mt-4" onClick={resume}>
                Resume operations
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <DecisionSheet />
      <Toaster theme="dark" position="bottom-right" />
    </TooltipProvider>
  );
}
