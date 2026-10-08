import { Panel, Kicker, Meta } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AMENDMENT_PRESETS,
  AUTONOMY_LEVELS,
  CONSTITUTION_VERSION,
  GARTNER_LEVELS,
  PROVISIONS,
  RATIFIED_AT,
} from "@/lib/aegis/data";
import { useAegis } from "@/lib/aegis/store";
import { cn, pct } from "@/lib/utils";
import type { SignRole } from "@/lib/aegis/types";

const ROLES: SignRole[] = ["CEO", "CCO", "Board Audit Chair"];

export function ConstitutionPage() {
  const amendment = useAegis((s) => s.amendment);
  const propose = useAegis((s) => s.proposeAmendment);
  const sign = useAegis((s) => s.signAmendment);
  const simTime = useAegis((s) => s.simTime);
  const maxSingle = useAegis((s) => s.maxSingle);
  const lockLeft = amendment?.status === "timelock" ? Math.max(0, amendment.timeLockEnds - simTime) : 0;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Kicker>Canon · v{CONSTITUTION_VERSION}</Kicker>
        <h1 className="font-display text-4xl text-foreground md:text-5xl">The bounds of autonomy.</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Machine-readable. Immutable at runtime. Amended only by multi-signature after simulation and a
          time-lock. Ratified {RATIFIED_AT.slice(0, 10)}. Threshold 2 of 3.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-3">
          {PROVISIONS.map((p) => (
            <article key={p.id} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-primary">{p.id}</span>
                <Badge>P{p.priority}</Badge>
                <Badge tone={p.enforcement === "hard_block" ? "danger" : "default"}>{p.enforcement.replaceAll("_", " ")}</Badge>
              </div>
              <h2 className="font-display mt-3 text-2xl text-foreground">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
              {p.id === "ART-2" ? (
                <p className="mt-3 font-mono text-xs text-muted-foreground">
                  Live cap {maxSingle.toLocaleString()} · daily 10,000,000
                </p>
              ) : null}
            </article>
          ))}
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Panel>
            <Kicker>Amendment protocol</Kicker>
            <h2 className="font-display mt-2 text-2xl text-foreground">Propose, simulate, sign.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The planner cannot touch these provisions. Humans — and only humans — amend them.
            </p>

            {!amendment ? (
              <ul className="mt-4 space-y-2">
                {AMENDMENT_PRESETS.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => propose(p.id)}
                      className="w-full rounded-md bg-raised px-3 py-3 text-left transition-colors duration-150 hover:bg-muted"
                    >
                      <p className="text-sm text-foreground">{p.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{p.rationale}</p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <Badge
                    tone={
                      amendment.status === "deployed"
                        ? "ok"
                        : amendment.status === "simulating"
                          ? "info"
                          : "warn"
                    }
                  >
                    {amendment.status}
                  </Badge>
                  <p className="mt-2 text-sm text-foreground">{amendment.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {amendment.provision} · {amendment.field} {amendment.from} → {amendment.to}
                  </p>
                </div>

                {amendment.status === "simulating" ? (
                  <div>
                    <Meta label="Sandbox">
                      {amendment.simEpisodes.toLocaleString()} / {amendment.simTotal.toLocaleString()}
                    </Meta>
                    <div className="h-1 overflow-hidden rounded-full bg-raised">
                      <div
                        className="h-full bg-primary transition-[width] duration-300"
                        style={{ width: pct(amendment.simEpisodes / amendment.simTotal, 0) }}
                      />
                    </div>
                  </div>
                ) : null}

                {amendment.status === "review" || amendment.status === "timelock" || amendment.status === "deployed" ? (
                  <p className="text-sm text-ok">10,000 episodes. No constitutional conflict. Ready for signature.</p>
                ) : null}

                {(amendment.status === "review" || amendment.status === "timelock") && (
                  <div className="flex flex-col gap-2">
                    {ROLES.map((role) => {
                      const done = amendment.signatures.includes(role);
                      return (
                        <Button
                          key={role}
                          size="sm"
                          variant={done ? "secondary" : "outline"}
                          disabled={done || amendment.status !== "review"}
                          onClick={() => sign(role)}
                        >
                          {done ? `Signed · ${role}` : `Sign as ${role}`}
                        </Button>
                      );
                    })}
                    <p className="text-xs text-muted-foreground">
                      {amendment.signatures.length} of 2 required. 72-hour lock compressed for this demo.
                    </p>
                  </div>
                )}

                {amendment.status === "timelock" ? (
                  <p className="font-mono text-sm tabular-nums text-warn">
                    Time-lock {Math.ceil(lockLeft / 1000)}s
                  </p>
                ) : null}

                {amendment.status === "deployed" ? (
                  <p className="text-sm text-ok">Deployed across the fleet. Runtime envelope updated.</p>
                ) : null}
              </div>
            )}
          </Panel>

          <Panel>
            <Kicker>Authority ladder</Kicker>
            <ol className="mt-3 space-y-2">
              {GARTNER_LEVELS.map((g) => (
                <li
                  key={g.level}
                  className={cn(
                    "rounded-sm px-3 py-2",
                    g.level === 4 ? "bg-primary text-primary-foreground" : "bg-raised",
                  )}
                >
                  <p className="text-sm">
                    L{g.level} {g.name}
                  </p>
                  <p className={cn("text-xs", g.level === 4 ? "opacity-80" : "text-muted-foreground")}>{g.detail}</p>
                </li>
              ))}
            </ol>
            <Kicker className="mt-5">Autonomy taxonomy</Kicker>
            <ol className="mt-3 space-y-2">
              {AUTONOMY_LEVELS.map((a) => (
                <li key={a.id} className={cn("rounded-sm px-3 py-2", a.id === "A3" ? "bg-raised shadow-[var(--shadow-border)]" : "")}>
                  <p className="text-sm text-foreground">
                    {a.id} {a.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{a.detail}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}
