import { createFileRoute } from "@tanstack/react-router";
import { useOfficeSnapshot } from "@/components/office/office-snapshot-hook";
import { DispatchPanel } from "@/components/office/dispatch-panel";
import { PageHeader } from "@/components/office/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CONSTITUTION_PREAMBLE } from "@/lib/office/constitution";

export const Route = createFileRoute("/office/constitution")({
  component: ConstitutionPage,
});

function ConstitutionPage() {
  const snapshot = useOfficeSnapshot();

  return (
    <div className="enter-up mx-auto max-w-3xl">
      <PageHeader
        kicker={`Constitution v${snapshot.company.constitutionVersion}`}
        title="The bounds are machine-readable."
        description={`Ratified by ${snapshot.company.authorName}, ${snapshot.company.authorRole}. Immutable at runtime. Amendment is a founder act.`}
      />
      <Card className="mb-6">
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Preamble</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">{CONSTITUTION_PREAMBLE}</p>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-muted">Jurisdiction</dt>
            <dd>Republic of South Africa</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-muted">Autonomy</dt>
            <dd>A3 within role</dd>
          </div>
        </dl>
      </Card>

      <ol className="space-y-3">
        {snapshot.provisions.map((p) => (
          <li key={p.id} className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[11px] tracking-[0.16em] text-muted">
                {p.articleId} · priority {p.priority}
              </p>
              <Badge variant={p.enforcement === "hard_block" ? "danger" : "default"}>
                {p.enforcement.replaceAll("_", " ")}
              </Badge>
            </div>
            <h2 className="mt-2 font-serif text-2xl">{p.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        <DispatchPanel
          lockedAgent="seal"
          placeholder="Review the constitution against current work. Veto anything off-role. Do not amend it."
        />
      </div>
    </div>
  );
}
