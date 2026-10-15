import { Link, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  BookOpen,
  ClipboardCheck,
  Gavel,
  Headset,
  Inbox,
  LayoutGrid,
  MessageCircle,
  Menu,
  Radio,
  Scale,
  ScrollText,
  Shield,
  SquareActivity,
  Tags,
  Wrench,
  Megaphone,
} from "lucide-react";
import { useEffect, useState } from "react";
import { WatchtowerMark } from "@/components/brand/mark";
import { Button } from "@/components/ui/button";
import { UserButton } from "@/lib/auth/gates";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { haltOffice } from "@/lib/office/api";
import { formatNowClock, formatZar } from "@/lib/office/money";
import type { OfficeSnapshot } from "@/lib/office/types";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/office", label: "Command", icon: LayoutGrid },
  { to: "/office/approvals", label: "Approvals", icon: ClipboardCheck },
  { to: "/office/floor", label: "Floor", icon: Radio },
  { to: "/office/inbox", label: "Inbox", icon: Inbox },
  { to: "/office/chat", label: "Chat", icon: MessageCircle },
  { to: "/office/service", label: "Service", icon: Headset },
  { to: "/office/catalogue", label: "Catalogue", icon: Tags },
  { to: "/office/marketing", label: "Marketing", icon: Megaphone },
  { to: "/office/sales", label: "Sales", icon: Scale },
  { to: "/office/ledger", label: "Ledger", icon: BookOpen },
  { to: "/office/technical", label: "Technical", icon: Wrench },
  { to: "/office/constitution", label: "Constitution", icon: Gavel },
  { to: "/office/audit", label: "Audit", icon: ScrollText },
  { to: "/office/metrics", label: "Metrics", icon: SquareActivity },
] as const;

function NavLinks({
  pending,
  onNavigate,
}: {
  pending: number;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className="flex h-11 items-center gap-3 rounded-md px-3 text-sm text-muted transition-colors duration-150 hover:bg-raised hover:text-fg"
            activeProps={{ className: "bg-raised text-fg" }}
            activeOptions={item.to === "/office" ? { exact: true } : undefined}
          >
            <Icon className="size-4" />
            <span className="flex-1">{item.label}</span>
            {item.to === "/office/approvals" && pending > 0 ? (
              <span className="rounded-full bg-warn/15 px-2 py-0.5 font-mono text-[11px] text-warn">
                {pending}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  snapshot,
  children,
}: {
  snapshot: OfficeSnapshot;
  children: ReactNode;
}) {
  const router = useRouter();
  const [clock, setClock] = useState(formatNowClock);
  const [menuOpen, setMenuOpen] = useState(false);
  const pending = snapshot.approvals.filter((a) => a.status === "pending").length;
  const [haltPending, setHaltPending] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setClock(formatNowClock()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  async function toggleHalt() {
    setHaltPending(true);
    try {
      await haltOffice({
        data: {
          halted: !snapshot.company.halted,
          reason: snapshot.company.halted
            ? "Founder resumed operations."
            : "Founder halt. ART-10: agents must not resist.",
        },
      });
      await router.invalidate();
    } finally {
      setHaltPending(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <a
        href="#office-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-accent-fg"
      >
        Skip to main content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col overflow-hidden border-r border-border bg-bg p-4 lg:flex">
        <Link to="/office" className="mb-6 flex shrink-0 items-center gap-3 px-2">
          <WatchtowerMark className="size-6 text-accent" />
          <span className="leading-none">
            <span className="block font-serif text-xl">Vantage</span>
            <span className="block font-mono text-[10px] tracking-[0.28em] text-muted">ARS</span>
          </span>
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavLinks pending={pending} />
        </div>
        <div className="shrink-0 space-y-3 px-2 pt-6">
          <p className="font-mono text-[11px] text-muted">vantage-ars.co.za</p>
          <div className="text-xs text-muted">
            <UserButton />
          </div>
          <Link to="/" className="block text-xs text-muted underline-offset-4 hover:text-fg hover:underline">
            Public site
          </Link>
          <Button
            variant={snapshot.company.halted ? "default" : "danger"}
            size="sm"
            className="w-full"
            onClick={toggleHalt}
            disabled={haltPending}
          >
            <Shield className="size-3.5" />
            {snapshot.company.halted ? "Resume office" : "Halt office"}
          </Button>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/95 px-4 backdrop-blur-sm">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-4">
              <div className="mb-6 flex items-center gap-3 px-2">
                <WatchtowerMark className="size-6 text-accent" />
                <span className="font-serif text-xl">Vantage-ARS</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <NavLinks pending={pending} onNavigate={() => setMenuOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="hidden items-center gap-2 text-xs text-muted sm:flex">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  snapshot.company.halted ? "bg-danger" : "live-dot bg-ok",
                )}
              />
              {snapshot.company.halted ? "Halted" : "A3 live"}
            </span>
            <span className="truncate font-mono text-xs text-muted">
              {clock.date} · {clock.time} SAST
            </span>
          </div>
          <div className="flex items-center gap-3">
            {pending > 0 ? (
              <Link
                to="/office/approvals"
                className="inline-flex h-9 items-center rounded-full bg-warn/15 px-3 font-mono text-xs text-warn lg:hidden"
              >
                {pending}
              </Link>
            ) : null}
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Treasury</p>
              <p className="font-mono text-sm tabular-nums text-fg">
                {formatZar(snapshot.company.treasuryCents)}
              </p>
            </div>
          </div>
        </header>

        {snapshot.company.halted ? (
          <div className="border-b border-danger/30 bg-danger/10 px-4 py-2 text-center text-sm text-danger">
            Office halted. {snapshot.company.haltReason}
          </div>
        ) : null}

        <main id="office-main" className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
