import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { WatchtowerMark } from "@/components/brand/mark";
import { COMPANY } from "@/lib/office/company";
import { SERVICE_PAGES } from "@/lib/site/services";

const nav = [
  { to: "/", hash: "services", label: "Services" },
  { to: "/work", hash: undefined, label: "Work" },
  { to: "/rates", hash: undefined, label: "Rates" },
  { to: "/support", hash: undefined, label: "Service desk" },
] as const;

const trustPills = ["Written quote first", "No retainer", "Remote support worldwide"] as const;

export function PublicFrame({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-accent-fg"
      >
        Skip to main content
      </a>
      <div className="relative z-10 bg-[#0e1c33] py-2 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-white/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3 px-4 sm:px-6">
          {trustPills.map((item) => (
            <span key={item} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] tracking-[0.18em]">
              {item}
            </span>
          ))}
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0e1c33]/95 text-white backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 text-white" aria-label="Vantage-ARS home">
            <WatchtowerMark className="size-5 text-[#7ec8ff]" />
            <span className="font-mono text-xs tracking-[0.18em]">VANTAGE-ARS</span>
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-6 md:flex">
            {nav.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                hash={item.hash}
                className="text-sm text-white/70 transition-colors hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              className="text-sm text-white/70 transition-colors hover:text-white"
              onClick={() => window.dispatchEvent(new Event("vantage-open-chat"))}
            >
              Chat
            </button>
          </nav>

          <Link
            to="/"
            hash="enquiry"
            className="hidden h-10 items-center rounded-md bg-white px-4 text-sm font-medium text-[#0e1c33] transition-opacity hover:opacity-95 md:inline-flex"
          >
            Get a quote
          </Link>

          <div ref={menuRef} className="relative md:hidden">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-10 cursor-pointer items-center rounded-md bg-white px-3 text-sm font-medium text-[#0e1c33]"
            >
              Menu
            </button>
            {menuOpen ? (
              <nav
                id="mobile-nav"
                aria-label="Mobile navigation"
                className="absolute right-0 z-40 mt-2 w-56 rounded-xl bg-surface p-2 text-fg shadow-[var(--shadow-border)]"
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
      </header>

      <main id="main-content" className="relative z-10 mx-auto max-w-7xl px-5 pb-28 sm:px-8">{children}</main>

      <footer className="relative z-10 border-t border-border bg-[#0e1c33] text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
          <div>
            <p className="font-mono text-xs tracking-[0.18em]">VANTAGE-ARS</p>
            <p className="mt-2 text-sm text-white/70">VoIP, networking and IT infrastructure.</p>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            {SERVICE_PAGES.map((page) => (
              <Link key={page.slug} to="/services/$slug" params={{ slug: page.slug }} className="text-white/70 transition-colors hover:text-white">
                {page.title}
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <Link to="/work" className="text-white/70 transition-colors hover:text-white">
              Work
            </Link>
            <Link to="/rates" className="text-white/70 transition-colors hover:text-white">
              Rates
            </Link>
            <Link to="/support" className="text-white/70 transition-colors hover:text-white">
              Service desk
            </Link>
            <Link to="/terms" className="text-white/70 transition-colors hover:text-white">
              How work is agreed
            </Link>
            <Link to="/privacy" className="text-white/70 transition-colors hover:text-white">
              Privacy
            </Link>
          </div>

          <div className="text-sm text-white/70">
            <a className="transition-colors hover:text-white" href={`mailto:${COMPANY.email}`}>
              {COMPANY.email}
            </a>
            <p className="mt-2">South African rand. A written quote before any work.</p>
            <Link to="/office" className="mt-4 inline-block text-xs text-white/50 transition-colors hover:text-white">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
