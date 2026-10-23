import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { searchOffice, type OfficeSearchKind } from "@/lib/office/search";
import type { OfficeSnapshot } from "@/lib/office/types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<OfficeSearchKind, string> = {
  page: "Office",
  customer: "Customer",
  approval: "Approval",
  ticket: "Ticket",
  document: "Document",
  money: "Ledger",
  plan: "Plan",
  lead: "Lead",
  opportunity: "Opportunity",
  inbound: "Inbox",
  decision: "Decision",
  notice: "Notice",
  audit: "Audit",
};

export function OfficeSearch({
  snapshot,
  compact = false,
  shortcut = false,
}: {
  snapshot: OfficeSnapshot;
  compact?: boolean;
  /** Only one mounted instance should claim the global keyboard shortcut. */
  shortcut?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const hits = useMemo(() => searchOffice(snapshot, query), [snapshot, query]);

  useEffect(() => {
    if (!shortcut) return;
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcut]);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Search the office"
        aria-keyshortcuts="Control+K Meta+K"
        className={cn("gap-2", compact && "px-2.5")}
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" aria-hidden="true" />
        {compact ? null : <span>Search</span>}
        {compact ? null : (
          <kbd className="ml-2 hidden rounded border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted xl:inline">
            ⌘K
          </kbd>
        )}
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="max-h-[min(80dvh,42rem)] w-[min(100%-1.5rem,44rem)] overflow-hidden p-0">
          <div className="border-b border-border p-4 pr-12">
            <DialogTitle className="sr-only">Search the office</DialogTitle>
            <DialogDescription className="sr-only">
              Search customers, approvals, tickets, money records and office pages.
            </DialogDescription>
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customers, approvals, tickets, money…"
              aria-label="Search query"
              className="border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="max-h-[calc(80dvh-5rem)] overflow-y-auto p-2">
            {query.trim().length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted">
                Type a company, ticket, approval, invoice or page name.
              </p>
            ) : hits.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted">
                Nothing in the office record matches that.
              </p>
            ) : (
              <ul className="space-y-1">
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <Link
                      to={hit.href as never}
                      onClick={() => changeOpen(false)}
                      className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-raised"
                    >
                      <span className="mt-0.5 w-16 shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-subtle">
                        {KIND_LABEL[hit.kind]}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-fg">{hit.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {hit.detail}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
