import { Badge } from "@/components/ui/badge";
import type { DecisionStatus, GovernorVerdict } from "@/lib/aegis/types";

export function VerdictBadge({ verdict }: { verdict: GovernorVerdict }) {
  const tone = verdict === "ALLOW" ? "ok" : verdict === "DENY" ? "danger" : "warn";
  return <Badge tone={tone}>{verdict}</Badge>;
}

export function StatusDot({ status }: { status: DecisionStatus | string }) {
  const tone =
    status === "authorized" || status === "nominal" || status === "resolved" || status === "Passing"
      ? "bg-ok"
      : status === "blocked" || status === "isolated" || status === "halted"
        ? "bg-danger"
        : status === "active"
          ? "bg-warn"
          : "bg-warn";
  return <span className={`inline-block size-1.5 rounded-full ${tone}`} />;
}
