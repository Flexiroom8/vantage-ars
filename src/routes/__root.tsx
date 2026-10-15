import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PublicChat } from "@/components/chat/live-chat";
import { PublicFrame } from "@/components/public/site-frame";
import { Link } from "@tanstack/react-router";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Vantage-ARS";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Worldwide remote VoIP, networking and IT infrastructure support from Vantage-ARS, with clear ZAR pricing.",
      },
      { name: "theme-color", content: "#050a14" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Instrument+Serif:ital@0;1&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  notFoundComponent: NotFound,
  component: () => (
    <html lang="en-ZA" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg">
        <PreviewHostBridge />
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <Outlet />
            <PublicChat />
          </TooltipProvider>
        </AuthProvider>
        <Toaster theme="dark" position="bottom-right" />
        <Scripts />
      </body>
    </html>
  ),
});

function NotFound() {
  return (
    <PublicFrame>
      <section className="py-24">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Missing page</p>
        <h1 className="mt-4 font-serif text-4xl tracking-[-0.03em]">That page is not on this site.</h1>
        <p className="mt-4 max-w-md text-sm text-muted">
          The services, the service desk, and the published rates are still here.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex h-11 items-center text-sm text-accent underline-offset-4 hover:underline"
        >
          Back to services
        </Link>
      </section>
    </PublicFrame>
  );
}
