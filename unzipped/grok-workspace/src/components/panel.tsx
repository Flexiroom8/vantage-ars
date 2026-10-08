import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={cn("rounded-xl bg-card p-4 shadow-[var(--shadow-border)]", className)} {...props} />;
}

export function Kicker({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs font-medium tracking-[0.16em] text-subtle uppercase", className)} {...props} />
  );
}

export function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-xs tracking-wide text-subtle uppercase">{label}</span>
      <span className="text-right font-mono text-sm text-foreground tabular-nums">{children}</span>
    </div>
  );
}
