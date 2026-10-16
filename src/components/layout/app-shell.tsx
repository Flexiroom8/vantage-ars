import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { WatchtowerMark } from "@/components/brand/mark";
import { LiveField } from "@/components/public/live-field";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { haltOffice } from "@/lib/office/api";
import { COMPANY } from "@/lib/office/company";
import { formatNowClock, formatZar } from "@/lib/office/format";
import type { OfficeSnapshot } from "@/lib/office/types";
import { cn } from "@/lib/utils";
import { UserButton } from "@/lib/auth/gates";

type AppShellProps = {
  snapshot?: OfficeSnapshot | null;
  children: React.ReactNode;
};

const NAV_ITEMS = [
  { href: "/office", label: "Command" },
  { href: "/office/approvals", label: "Approvals" },
  { href: "/office/floor", label: "Floor" },
  { href: "/office/inbox", label: "Inbox" },
  { href: "/office/chat", label: "Chat" },
  { href: "/office/service", label: "Service" },
  { href: "/office/catalogue", label: "Catalogue" },
  { href: "/office/marketing", label: "Marketing" },
  { href: "/office/sales", label: "Sales" },
  { href: "/office/ledger", label: "Ledger" },
  { href: "/office/technical", label: "Technical" },
  { href: "/office/constitution", label: "Constitution" },
  { href: "/office/audit", label: "Audit" },
  { href: "/office/metrics", label: "Metrics" },
];

function NavLink({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick?: () => void;
}) {
  const location = useLocation();

  const active =
    href === "/office"
      ? location.pathname === "/office"
      : location.pathname.startsWith(href);

  return (
    <Link
      to={href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center justify-between border px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-all",
        active
          ? "border-accent/30 bg-accent/10 text-accent"
          : "border-transparent text-muted hover:border-border/60 hover:bg-raised/40 hover:text-fg",
      )}
    >
      <span>{label}</span>

      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full transition-opacity",
          active
            ? "bg-accent opacity-100"
            : "bg-muted opacity-0 group-hover:opacity-40",
        )}
      />
    </Link>
  );
}

function OfficeNavigation({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav
      className={cn(
        "space-y-1",
        mobile ? "px-1 py-4" : "px-3 py-5",
      )}
    >
      <div className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[0.22em] text-muted">
        Operations
      </div>

      {NAV_ITEMS.slice(0, 11).map((item) => (
        <NavLink
          key={item.href}
          {...item}
          onClick={onNavigate}
        />
      ))}

      <div className="mb-3 mt-7 px-3 font-mono text-[9px] uppercase tracking-[0.22em] text-muted">
        Governance
      </div>

      {NAV_ITEMS.slice(11).map((item) => (
        <NavLink
          key={item.href}
          {...item}
          onClick={onNavigate}
        />
      ))}
    </nav>
  );
}

export function AppShell({ snapshot, children }: AppShellProps) {
  const router = useRouter();
  const [halted, setHalted] = useState(false);
  const [halting, setHalting] = useState(false);

  const treasury = snapshot?.treasury?.available ?? 0;

  async function handleHalt() {
    if (halting) return;

    setHalting(true);

    try {
      await haltOffice();
      setHalted(true);
      await router.invalidate();
    } finally {
      setHalting(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg text-fg">
      <LiveField />

      <div className="relative z-10 min-h-dvh">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border/70 bg-surface/50 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="border-b border-border/70 px-5 py-5">
            <Link
              to="/office"
              className="group flex items-center gap-3"
            >
              <WatchtowerMark className="h-9 w-9 shrink-0 transition-transform group-hover:scale-105" />

              <div className="min-w-0">
                <div className="font-mono text-xs font-semibold tracking-[0.2em]">
                  VANTAGE-ARS
                </div>

                <div className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
                  Network operations desk
                </div>
              </div>
            </Link>
          </div>

          <div className="border-b border-border/50 px-5 py-3">
            <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em]">
              <span className="flex items-center gap-2 text-muted">
                <span
                  className={cn(
                    "live-dot",
                    halted && "opacity-40",
                  )}
                />
                {halted ? "Halted" : "A3 live"}
              </span>

              <span className="text-accent">SAST</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <OfficeNavigation />
          </div>

          <div className="border-t border-border/70 p-4">
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="border border-border/60 bg-bg/30 p-3">
                <div className="font-mono text-[8px] uppercase tracking-[0.15em] text-muted">
                  Treasury
                </div>
                <div className="mt-1 font-mono text-xs text-fg">
                  {formatZar(treasury)}
                </div>
              </div>

              <div className="border border-border/60 bg-bg/30 p-3">
                <div className="font-mono text-[8px] uppercase tracking-[0.15em] text-muted">
                  Clock
                </div>
                <div className="mt-1 font-mono text-xs text-fg">
                  {formatNowClock()}
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-center border-red-500/20 text-red-300 hover:border-red-500/40 hover:bg-red-500/5"
              disabled={halting || halted}
              onClick={handleHalt}
            >
              {halting ? "Haltingâ¦" : halted ? "Office halted" : "Halt office"}
            </Button>
          </div>
        </aside>

        {/* Mobile header */}
        <div className="sticky top-0 z-50 border-b border-border/70 bg-bg/80 backdrop-blur-xl lg:hidden">
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="Open office navigation"
                  >
                    Menu
                  </Button>
                </SheetTrigger>

                <SheetContent
                  side="left"
                  className="w-[290px] border-r border-border/70 bg-bg/95 p-0 backdrop-blur-xl"
                >
                  <div className="border-b border-border/70 px-5 py-5">
                    <Link
                      to="/office"
                      className="flex items-center gap-3"
                    >
                      <WatchtowerMark className="h-9 w-9" />

                      <div>
                        <div className="font-mono text-xs font-semibold tracking-[0.2em]">
                          VANTAGE-ARS
                        </div>

                        <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
                          Network operations desk
                        </div>
                      </div>
                    </Link>
                  </div>

                  <div className="max-h-[calc(100dvh-90px)] overflow-y-auto">
                    <OfficeNavigation mobile />
                  </div>
                </SheetContent>
              </Sheet>

              <Link to="/office" className="flex items-center gap-2">
                <WatchtowerMark className="h-7 w-7" />

                <span className="font-mono text-[10px] font-semibold tracking-[0.18em]">
                  VANTAGE-ARS
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden font-mono text-[9px] uppercase tracking-[0.15em] text-muted sm:inline">
                {halted ? "Halted" : "A3 live"}
              </span>

              <UserButton />
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:pl-64">
          <header className="hidden border-b border-border/70 bg-bg/65 backdrop-blur-xl lg:block">
            <div className="flex h-16 items-center justify-between px-6 xl:px-8">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted">
                  Private operations
                </div>

                <div className="mt-1 flex items-center gap-2 font-mono text-xs">
                  <span className="live-dot" />
                  {halted ? "Office halted" : "Network operations active"}
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
                    SAST
                  </div>

                  <div className="font-mono text-xs">
                    {formatNowClock()}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
                    Treasury
                  </div>

                  <div className="font-mono text-xs text-accent">
                    {formatZar(treasury)}
                  </div>
                </div>

                <UserButton />
              </div>
            </div>
          </header>

          <main className="relative min-h-[calc(100dvh-4rem)] px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
            <div className="mx-auto w-full max-w-[1600px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
        }
