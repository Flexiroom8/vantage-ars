import type { ProvisionCheck } from "@/lib/office/types";
import { cn } from "@/lib/utils";

export function TraceList({ trace }: { trace: ProvisionCheck[] }) {
  return (
    <ol className="space-y-2">
      {trace.map((item, index) => (
        <li key={`${item.provision}-${item.check}-${index}`} className="flex gap-3 text-sm">
          <span
            className={cn(
              "mt-1 size-1.5 shrink-0 rounded-full",
              item.passed ? "bg-ok" : "bg-danger",
            )}
          />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
              {item.provision} · {item.check}
            </p>
            <p className="text-fg">{item.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
