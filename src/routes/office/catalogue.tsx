import { createFileRoute } from "@tanstack/react-router";
import { useOfficeSnapshot } from "@/components/office/office-context";
import { PageHeader } from "@/components/office/page-header";
import { Badge } from "@/components/ui/badge";
import { PUBLISHED_RATES } from "../../lib/office/catalogue";

export const Route = createFileRoute("/office/catalogue")({
  component: CataloguePage,
});


function CataloguePage() {
  const snapshot = useOfficeSnapshot();
  const offered = PUBLISHED_RATES.filter((rate) => rate.offered);
  const withheld = PUBLISHED_RATES.filter((rate) => !rate.offered);

  return (
    <div className="enter-up mx-auto max-w-5xl">
      <PageHeader
        kicker="Published · 2 October 2026"
        title="These are the only prices."
        description={`Customer-facing ZAR rates for ${snapshot.company.domain}. Agents may cite this catalogue and nothing else. A written quote still confirms scope, VAT, travel, and third-party costs before work starts.`}
      />
      <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
        {offered.map((rate) => (
          <li key={rate.id} className="grid gap-2 px-4 py-4 sm:grid-cols-[1fr_auto] sm:gap-8">
            <div>
              <p className="text-sm font-medium">{rate.title}</p>
              <p className="mt-1 text-sm text-muted">{rate.scope}</p>
              <p className="mt-1 text-xs text-subtle">{rate.basis}</p>
            </div>
            <p className="font-mono text-sm sm:text-right">{rate.price}</p>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        {withheld.map((rate) => (
          <div key={rate.id} className="rounded-xl bg-raised p-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{rate.title}</p>
              <Badge variant="warn">Not offered</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">{rate.basis}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
