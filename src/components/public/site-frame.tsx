import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { WatchtowerMark } from "@/components/brand/mark";
import { COMPANY } from "@/lib/office/company";
import { SERVICE_PAGES } from "@/lib/site/services";

const nav = [
  { to: "/", hash: "services", label: "Services" },
  { to: "/work", hash: undefined, label: "Work" },
  { to: "/rates", hash: undefined, label: "Rates" },
  { to: "/support", hash: undefined, label: "Service desk" },
] as const;

export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className="site relative min-h-dvh bg-bg">
      <div className="relative z-10 h-1 bg-accent" />
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0e1c33] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 text-white">
            <WatchtowerMark className="size-5 text-[#7ec8ff]" />
            <span className="font-mono text-xs tracking-[0.18em]">VANTAGE-ARS</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {nav.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                hash={item.hash}
                className="text-sm text-white/70 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              className="text-sm text-white/70 hover:text-white"
              onClick={() => window.dispatchEvent(new Event("vantage-open-chat"))}
            >
              Chat
            </button>
          </nav>
          <Link
            to="/"
            hash="enquiry"
            className="hidden h-10 items-center rounded-md bg-white px-4 text-sm font-medium text-[#0e1c33] md:inline-flex"
          >
            Get a quote
          </Link>
          <details className="relative md:hidden">
            <summary className="flex h-10 cursor-pointer list-none items-center rounded-md bg-white px-3 text-sm font-medium text-[#0e1c33]">
              Menu
            </summary>
            <nav className="absolute right-0 z-40 mt-2 w-52 rounded-xl bg-surface p-2 text-fg shadow-[var(--shadow-border)]">
              {nav.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  hash={item.hash}
                  className="block rounded-md px-3 py-2 text-sm hover:bg-raised"
                >
                  {item.label}
                </Link>
              ))}
                <button
                  type="button"
                  className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-raised"
                  onClick={() => window.dispatchEvent(new Event("vantage-open-chat"))}
                >
                  Chat
                </button>
            </nav>
          </details>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-28 sm:px-8">{children}</main>
      <footer className="relative z-10 border-t border-border bg-[#0e1c33] text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
          <div>
            <p className="font-mono text-xs tracking-[0.18em]">VANTAGE-ARS</p>
            <p className="mt-2 text-sm text-white/70">VoIP, networking and IT infrastructure.</p>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            {SERVICE_PAGES.map((page) => (
              <Link key={page.slug} to="/services/$slug" params={{ slug: page.slug }} className="text-white/70 hover:text-white">
                {page.title}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <Link to="/work" className="text-white/70 hover:text-white">
              Work
            </Link>
            <Link to="/rates" className="text-white/70 hover:text-white">
              Rates
            </Link>
            <Link to="/support" className="text-white/70 hover:text-white">
              Service desk
            </Link>
            <Link to="/terms" className="text-white/70 hover:text-white">
              How work is agreed
            </Link>
            <Link to="/privacy" className="text-white/70 hover:text-white">
              Privacy
            </Link>
          </div>
          <div className="text-sm text-white/70">
            <a className="hover:text-white" href={`mailto:${COMPANY.email}`}>
              {COMPANY.email}
            </a>
            <p className="mt-2">South African rand. A written quote before any work.</p>
            <Link to="/office" className="mt-4 inline-block text-xs text-white/50 hover:text-white">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
