import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { WatchtowerMark } from "@/components/brand/mark";
import { COMPANY } from "@/lib/office/company";
import { formatNowClock } from "@/lib/office/money";
import { LiveField } from "@/components/public/live-field";
import { GlobeIcon, NoTiesIcon, QuoteIcon, SignalBars } from "@/components/public/motion-icons";
import { SERVICE_PAGES } from "@/lib/site/services";

const nav = [
  { to: "/", hash: "services", label: "Services" },
  { to: "/work", hash: undefined, label: "Work" },
  { to: "/rates", hash: undefined, label: "Rates" },
  { to: "/support", hash: undefined, label: "Service desk" },
] as const;

const trustPills = [
  { label: "Written quote first", Icon: QuoteIcon },
  { label: "No retainer", Icon: NoTiesIcon },
  { label: "Remote support worldwide", Icon: GlobeIcon },
] as const;

export function PublicFrame({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [clock, setClock] = useState(formatNowClock);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setClock(formatNowClock()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    function onPointer(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);

  return (
    <div className="site relative min-h-dvh bg-bg">
      <LiveField />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-accent-fg"
      >
        Skip to main content
      </a>

      <div className="relative z-10 border-b border-border/60 bg-surface/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-5 gap-y-1 px-4 py-2 sm:px-6">
          <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            <SignalBars className="size-3.5 text-accent" aria-hidden="true" />
            VoIP · Networking · IT infrastructure
          </span>
          <span className="hidden h-3 w-px bg-border sm:block" aria-hidden="true" />
          {trustPills.map(({ label, Icon }) => (
            <span key={label} className="flex items-center gap-1.5 text-[11px] tracking-[0.14em] text-subtle uppercase">
              <Icon className="size-3.5 text-accent" aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Vantage-ARS home">
            <WatchtowerMark className="size-6 text-accent" />
            <span className="leading-none">
              <span className="block font-mono text-xs tracking-[0.22em] text-fg">VANTAGE-ARS</span>
              <span className="mt-0.5 hidden font-mono text-[9px] tracking-[0.28em] text-subtle sm:block">
                NETWORK OPERATIONS DESK
              </span>
            </span>
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-7 md:flex">
            {nav.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                hash={item.hash}
                className="nav-link text-sm font-medium"
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              className="nav-link text-sm font-medium"
              onClick={() => window.dispatchEvent(new Event("vantage-open-chat"))}
            >
              Chat
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              hash="enquiry"
              className="cta hidden h-10 items-center rounded-md px-4 text-sm font-medium md:inline-flex"
            >
              Get a quote
            </Link>

            <div ref={menuRef} className="relative md:hidden">
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-controls="mobile-nav"
                onClick={() => setMenuOpen((open) => !open)}
                className="cta-ghost flex h-10 cursor-pointer items-center rounded-md px-3 text-sm font-medium"
              >
                Menu
              </button>
              {menuOpen ? (
                <nav
                  id="mobile-nav"
                  aria-label="Mobile navigation"
                  className="glass absolute right-0 z-40 mt-2 w-56 rounded-xl p-2 text-fg shadow-[var(--shadow-panel)]"
                >
                  {nav.map((item) => (
                    <Link
                      key={item.label}
                      to={item.to}
                      hash={item.hash}
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm hover:bg-raised"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-raised"
                    onClick={() => {
                      setMenuOpen(false);
                      window.dispatchEvent(new Event("vantage-open-chat"));
                    }}
                  >
                    Chat
                  </button>
                </nav>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="relative z-10 mx-auto max-w-7xl px-5 pb-28 sm:px-8">{children}</main>

      <footer className="relative z-10 border-t border-border bg-surface/60 backdrop-blur-sm">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <WatchtowerMark className="size-5 text-accent" />
              <p className="font-mono text-xs tracking-[0.22em]">VANTAGE-ARS</p>
            </div>
            <p className="mt-3 text-sm text-muted">VoIP, networking and IT infrastructure support.</p>
            <p className="mt-4 flex items-center gap-2 text-xs text-subtle">
              <span className="live-dot size-1.5 rounded-full bg-ok" aria-hidden="true" />
              Desk open · Remote worldwide
            </p>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-subtle">Services</p>
            {SERVICE_PAGES.map((page) => (
              <Link key={page.slug} to="/services/$slug" params={{ slug: page.slug }} className="text-muted transition-colors hover:text-fg">
                {page.title}
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-subtle">Company</p>
            <Link to="/work" className="text-muted transition-colors hover:text-fg">
              Work
            </Link>
            <Link to="/rates" className="text-muted transition-colors hover:text-fg">
              Rates
            </Link>
            <Link to="/support" className="text-muted transition-colors hover:text-fg">
              Service desk
            </Link>
            <Link to="/terms" className="text-muted transition-colors hover:text-fg">
              How work is agreed
            </Link>
            <Link to="/privacy" className="text-muted transition-colors hover:text-fg">
              Privacy
            </Link>
          </div>

          <div className="text-sm text-muted">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-subtle">Contact</p>
            <a className="mt-2 block transition-colors hover:text-fg" href={`mailto:${COMPANY.email}`}>
              {COMPANY.email}
            </a>
            <p className="mt-3">South African rand. A written quote before any work.</p>
            <Link to="/office" className="mt-4 inline-block text-xs text-subtle transition-colors hover:text-fg">
              Sign in
            </Link>
          </div>
        </div>
        <div className="border-t border-border">
          <p
            aria-hidden="true"
            className="select-none overflow-hidden px-4 pt-8 text-[clamp(3rem,11vw,9rem)] leading-none font-bold tracking-[-0.04em] text-fg/5 sm:px-6"
          >
            VANTAGE-ARS
          </p>
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-[11px] text-subtle sm:px-6">
            <p>© {new Date().getFullYear()} Vantage-ARS. Quoted work only — no retainer, no SLA.</p>
            <p className="flex items-center gap-3 font-mono">
              <span>R690/hr remote · R805/hr on-site · VAT only where quoted</span>
              <span className="hidden h-3 w-px bg-border sm:block" aria-hidden="true" />
              <span className="hidden items-center gap-1.5 sm:flex">
                <span className="live-dot size-1.5 rounded-full bg-ok" aria-hidden="true" />
                {clock.time} SAST
              </span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
