import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE =
  "An unexpected error occurred. Try reloading the page, or go back to the home page.";

/**
 * Never render `error.message` here. This component is used on public routes,
 * and a server error can carry SQL, table names, file paths or customer data.
 * The detail belongs in the server log, not in the visitor's browser.
 */
export function AppErrorComponent({ error }: ErrorComponentProps) {
  if (import.meta.env.DEV && error instanceof Error) {
    console.error(error);
  }
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <TriangleAlert className="size-10 text-danger" strokeWidth={2} aria-hidden="true" />
      <h1 className="font-serif text-2xl">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted">{FALLBACK_MESSAGE}</p>
      <a href="/" className="mt-2 text-sm font-medium text-accent underline underline-offset-4">
        Back to home
      </a>
    </main>
  );
}
