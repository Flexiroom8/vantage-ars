import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/office/empty-state";
import { MailNote } from "@/components/office/mail-note";
import { useOfficeSnapshot } from "@/components/office/office-snapshot-hook";
import { PageHeader } from "@/components/office/page-header";
import { TraceList } from "@/components/office/trace-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { decideApproval, skipApproval } from "@/lib/office/api";
import { approvalAgeDays } from "@/lib/office/approvals";
import { AGENT_BY_ID } from "@/lib/office/agents";
import { GATE_QUESTION_LABELS, MIN_REASONING_CHARS, REASON_CODES } from "@/lib/office/gate71";
import { formatDate, formatDateTime, formatZar } from "@/lib/office/money";
import type { ApprovalRow } from "@/lib/office/types";

export const Route = createFileRoute("/office/approvals")({
  component: ApprovalsPage,
});

// ── The decision context the office holds for one approval ────────────────────

/**
 * The shape `getApprovalContext` answers with.
 *
 * It is written out here rather than imported so the page keeps working while
 * the server function is still being written. The loader below reaches for the
 * function defensively and the page falls back to a plain approval view when
 * the context cannot be read — the founder must always be able to approve or
 * reject, even on the day the extra context is switched on.
 */
type ApprovalContext = {
  approval: {
    id: string;
    kind: string;
    title: string;
    rationale: string;
    amountCents: number;
    agentId: string;
    companyName: string | null;
    createdAt: string;
    riskScore: number;
    actionKind: string;
  };
  risk: {
    tier: number;
    name: string;
    rationale: string;
    gated: boolean;
    personalData: boolean;
  };
  gate: {
    legal: boolean;
    questions: { question: string; passed: boolean; detail: string }[];
    failed: string | null;
    summary: string;
  };
  requiresReasoning: boolean;
  reasonCodes: { code: string; label: string }[];
  precedent: {
    episodeId: string;
    actionKind: string;
    outcome: string;
    similarity: string;
    difference: string | null;
    effect: string;
    decidedAt: string;
    reasoning: string;
    reasonCode: string;
  }[];
  guidance: string;
};

type ApprovalContextLoader = (input: { data: { approvalId: string } }) => Promise<ApprovalContext>;

/**
 * Read the decision context for one approval.
 *
 * The function is looked up on the api module at call time, so a missing
 * export is a runtime condition and not a build failure. Callers treat a
 * throw as "no extra context" and carry on with the plain approval view.
 */
async function fetchApprovalContext(approvalId: string): Promise<ApprovalContext> {
  const api = (await import("@/lib/office/api")) as unknown as {
    getApprovalContext?: ApprovalContextLoader;
  };
  const load = api.getApprovalContext;
  if (typeof load !== "function") {
    throw new Error("The approval context is not available yet.");
  }
  const context = await load({ data: { approvalId } });
  if (!context || typeof context !== "object") {
    throw new Error("The approval context came back empty.");
  }
  return context;
}

type ContextStatus = "loading" | "ready" | "unavailable";

type LoadedContext = {
  approvalId: string;
  context: ApprovalContext | null;
  status: Exclude<ContextStatus, "loading">;
};

function useApprovalContext(approvalId: string): {
  context: ApprovalContext | null;
  status: ContextStatus;
} {
  const [loaded, setLoaded] = useState<LoadedContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchApprovalContext(approvalId)
      .then((context) => {
        if (cancelled) return;
        setLoaded({ approvalId, context, status: "ready" });
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded({ approvalId, context: null, status: "unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, [approvalId]);

  if (loaded?.approvalId === approvalId) {
    return { context: loaded.context, status: loaded.status };
  }
  return { context: null, status: "loading" };
}

// ── Plain-language helpers ───────────────────────────────────────────────────

const GATE_LABELS = GATE_QUESTION_LABELS as unknown as Record<string, string | undefined>;

function humanise(value: string): string {
  const text = value
    .replace(/^q\d+[_ ]*/, "")
    .replaceAll("_", " ")
    .trim();
  if (!text) return value;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function gateQuestionLabel(question: string): string {
  return GATE_LABELS[question] ?? humanise(question);
}

/** "1-Financial" and "Financial" both read as "Tier 1 — Financial". */
function tierLabel(tier: number, name: string): string {
  const clean = name.replace(/^\d+\s*[-–—]\s*/, "").trim();
  return `Tier ${tier} — ${clean || name.trim()}`;
}

function tierVariant(tier: number): "danger" | "warn" | "default" {
  if (tier <= 1) return "danger";
  if (tier <= 3) return "warn";
  return "default";
}

function similarityLabel(similarity: string): string {
  if (similarity === "strong_match") return "strong match";
  if (similarity === "related") return "related";
  if (similarity === "weak") return "weak match";
  return humanise(similarity);
}

/** What a precedent does to this decision. A precedent is evidence, never authority. */
function effectLabel(effect: string): string {
  if (effect === "tighten") {
    return "It tightens the checks: a similar decision was refused before, on the same terms.";
  }
  if (effect === "escalate_as_novel") {
    return "Treat this one as new: the earlier ruling was made under a different policy version.";
  }
  if (effect === "evidence") {
    return "It is evidence, not authority: it shows the pattern, and you decide afresh.";
  }
  return humanise(effect);
}

/** "a", "a and b", "a, b and c" — the blocked-button sentence reads like a person wrote it. */
function joinPhrases(phrases: string[]): string {
  if (phrases.length === 0) return "";
  if (phrases.length === 1) return phrases[0];
  return `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
}

function ApprovalsPage() {
  const snapshot = useOfficeSnapshot();
  const pending = snapshot.approvals.filter((a) => a.status === "pending");
  const resolved = snapshot.approvals.filter((a) => a.status !== "pending");
  const stale = pending.filter((item) => approvalAgeDays(item.createdAt) >= 7).length;

  return (
    <div className="enter-up mx-auto max-w-3xl">
      <PageHeader
        kicker="Founder desk"
        title="Approve only what the constitution cannot."
        description="Cost, customer win, customer loss, and marketing-to-sales handoffs stop here. Everything else already ran. Where the decision reaches a person, your reasoning is written down before you decide."
      />
      {stale > 0 ? (
        <p className="mb-4 rounded-xl border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-warn">
          {stale} approval{stale === 1 ? " has" : "s have"} been waiting seven days or more. An
          approval is not consent to act late; skip it if it no longer matters.
        </p>
      ) : null}
      <MailNote notices={snapshot.notices} mail={snapshot.mail} />
      {pending.length === 0 ? (
        <EmptyState
          title="Clear desk"
          body="No spend, no customer-risk, no sales handoff is waiting. The office continues without you."
        />
      ) : (
        <div className="space-y-4">
          {pending.map((item) => (
            <ApprovalCard key={item.id} item={item} />
          ))}
        </div>
      )}
      {resolved.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 font-serif text-2xl">Resolved</h2>
          <ul className="space-y-2">
            {resolved.slice(0, 12).map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg bg-surface px-4 py-3 shadow-[var(--shadow-border)]"
              >
                <div>
                  <p className="text-sm">{item.title}</p>
                  <p className="text-xs text-muted">{formatDateTime(item.createdAt)}</p>
                </div>
                <Badge
                  variant={
                    item.status === "approved"
                      ? "ok"
                      : item.status === "skipped"
                        ? "default"
                        : "danger"
                  }
                >
                  {item.status}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ApprovalCard({ item }: { item: ApprovalRow }) {
  const router = useRouter();
  const { context, status } = useApprovalContext(item.id);
  const [note, setNote] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [evidenceShown, setEvidenceShown] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"approved" | "rejected" | "skipped" | null>(null);
  const agent = AGENT_BY_ID[item.agentId];

  const base = `approval-${item.id}`;
  const noteId = `${base}-note`;
  const reasonCodeId = `${base}-reason-code`;
  const reasoningId = `${base}-reasoning`;
  const reasoningCounterId = `${base}-reasoning-counter`;
  const reasoningHintId = `${base}-reasoning-hint`;
  const evidenceId = `${base}-evidence`;
  const blockReasonId = `${base}-block-reason`;

  const requiresReasoning = context?.requiresReasoning === true;
  const reasoningLength = reasoning.trim().length;

  // The approve action is blocked until the founder has written the record
  // down. Each missing piece is named, so the button is never a dead end
  // without an explanation.
  const missing: string[] = [];
  if (requiresReasoning) {
    if (!reasonCode) missing.push("choose a reason code");
    if (reasoningLength < MIN_REASONING_CHARS) {
      missing.push(`write at least ${MIN_REASONING_CHARS} characters of reasoning`);
    }
    if (evidenceShown.trim() === "") missing.push("record the evidence you were shown");
  }
  const approveBlocked = missing.length > 0;

  async function skip() {
    setError("");
    setPending("skipped");
    try {
      const result = await skipApproval({
        data: { approvalId: item.id, note: note.trim() || undefined },
      });
      if (!result.ok) {
        setError(result.error ?? "Could not skip.");
        return;
      }
      toast.success("Skipped. Nothing was executed and no precedent was written.");
      await router.invalidate();
    } catch {
      setError("The skip could not be recorded — check the audit ledger before retrying.");
    } finally {
      setPending(null);
    }
  }

  async function resolve(decision: "approved" | "rejected") {
    setError("");
    setPending(decision);
    try {
      const payload = {
        approvalId: item.id,
        decision,
        note: note.trim() || undefined,
        ...(requiresReasoning
          ? {
              reasoning: reasoning.trim(),
              reasonCode,
              evidenceShown: evidenceShown.trim(),
            }
          : {}),
      };
      const result = await decideApproval({ data: payload });
      if (!result.ok) {
        setError(result.error ?? "Could not resolve.");
        return;
      }
      toast.success(decision === "approved" ? "Executed." : "Held.");
      await router.invalidate();
    } catch {
      // This is the path that executes a cost, a customer win/loss or a spend.
      // If it fails mid-flight the founder must know, or they will click again
      // unsure whether the action already ran.
      setError("The decision could not be recorded — check the audit ledger before retrying.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted">
            {agent?.callsign ?? item.agentId} · {item.kind.replaceAll("_", " ")}
          </p>
          <h2 className="mt-1 font-serif text-2xl">{item.title}</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {context ? (
            <Badge variant={tierVariant(context.risk.tier)}>
              {tierLabel(context.risk.tier, context.risk.name)}
            </Badge>
          ) : null}
          <Badge
            variant={
              item.kind === "cost"
                ? "warn"
                : item.kind.startsWith("customer")
                  ? "danger"
                  : "default"
            }
          >
            {item.kind.replaceAll("_", " ")}
          </Badge>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">{item.rationale}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted">Amount</dt>
          <dd className="mt-1 font-mono tabular-nums">{formatZar(item.amountCents)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted">Company</dt>
          <dd className="mt-1">{item.companyName ?? "—"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs uppercase tracking-[0.14em] text-muted">Filed</dt>
          <dd className="mt-1 text-muted">
            {formatDateTime(item.createdAt)} · waiting {approvalAgeDays(item.createdAt)} day
            {approvalAgeDays(item.createdAt) === 1 ? "" : "s"}
          </dd>
        </div>
      </dl>

      {status === "loading" ? (
        <p className="mt-4 text-xs text-muted">Reading the decision context…</p>
      ) : null}

      {status === "unavailable" ? (
        <p className="mt-4 border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">
          The risk tier, the section 71 gate and the precedent could not be read for this approval,
          so it is shown plainly. You can still approve or reject it.
        </p>
      ) : null}

      {context ? <RiskBlock context={context} /> : null}
      {context && context.gate.legal ? <GateBlock context={context} /> : null}
      {context ? <PrecedentBlock context={context} /> : null}

      {context && requiresReasoning ? (
        <ReasoningForm
          reasonCodeId={reasonCodeId}
          reasoningId={reasoningId}
          reasoningCounterId={reasoningCounterId}
          reasoningHintId={reasoningHintId}
          evidenceId={evidenceId}
          reasonCodes={context.reasonCodes}
          reasonCode={reasonCode}
          reasoning={reasoning}
          evidenceShown={evidenceShown}
          onReasonCode={setReasonCode}
          onReasoning={setReasoning}
          onEvidence={setEvidenceShown}
        />
      ) : null}

      <div className="mt-5">
        <p className="mb-2 text-xs uppercase tracking-[0.14em] text-muted">Constitutional trace</p>
        <TraceList trace={item.constitutionalTrace} />
      </div>
      <Label htmlFor={noteId} className="sr-only">
        Note for the audit ledger (optional)
      </Label>
      <Textarea
        id={noteId}
        className="mt-5"
        placeholder="Note for the audit ledger (optional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      {error ? (
        <p
          role="alert"
          className="mt-4 border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {approveBlocked ? (
        <p id={blockReasonId} role="status" className="mt-4 text-xs text-warn">
          Approve is blocked until you {joinPhrases(missing)}.
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="ghost"
          disabled={pending !== null}
          onClick={() => void skip()}
          className="sm:mr-auto"
        >
          {pending === "skipped" ? "Skipping…" : "Skip without deciding"}
        </Button>
        <Button
          variant="outline"
          disabled={pending !== null}
          onClick={() => void resolve("rejected")}
        >
          {pending === "rejected" ? "Rejecting…" : "Reject"}
        </Button>
        <Button
          disabled={pending !== null || approveBlocked}
          aria-describedby={approveBlocked ? blockReasonId : undefined}
          onClick={() => void resolve("approved")}
        >
          {pending === "approved" ? "Approving…" : "Approve and execute"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Rejecting needs no reasoning: you can refuse a thing without justifying it.
      </p>
    </Card>
  );
}

/** The tier, its name, and the one line saying why it sits there. */
function RiskBlock({ context }: { context: ApprovalContext }) {
  const { risk } = context;
  return (
    <section className="mt-5 rounded-xl bg-raised px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Risk</p>
        <div className="flex flex-wrap items-center gap-2">
          {risk.personalData ? <Badge variant="warn">Personal data</Badge> : null}
          <span className="font-mono text-xs tabular-nums text-muted">
            {formatZar(context.approval.amountCents)}
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm">
        <span className="font-medium">{tierLabel(risk.tier, risk.name)}.</span> {risk.rationale}
      </p>
      {context.approval.actionKind ? (
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
          {context.approval.actionKind.replaceAll("_", " ")}
        </p>
      ) : null}
    </section>
  );
}

/** The POPIA section 71 gate, in the order the regulator reads it. */
function GateBlock({ context }: { context: ApprovalContext }) {
  const { gate } = context;
  return (
    <section className="mt-5 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          POPIA section 71 · the legal gate
        </p>
        {gate.failed ? (
          <Badge variant="danger">Failed at: {gateQuestionLabel(gate.failed)}</Badge>
        ) : (
          <Badge variant="ok">All five passed</Badge>
        )}
      </div>
      <p className="mt-2 text-sm">
        This decision affects a person. Your reasoning must be written down <em>before</em> the
        decision, and the office must be able to explain the decision afterwards.
      </p>
      <ol className="mt-3 space-y-2">
        {gate.questions.map((answer, index) => (
          <li key={`${answer.question}-${index}`} className="flex gap-3 text-sm">
            <span
              className={`mt-0.5 shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] ${
                answer.passed ? "text-ok" : "text-danger"
              }`}
            >
              {answer.passed ? "Passed" : "Failed"}
            </span>
            <div>
              <p className="font-medium">{gateQuestionLabel(answer.question)}</p>
              <p className="text-muted">{answer.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 border-t border-border pt-3 text-sm">{gate.summary}</p>
    </section>
  );
}

/** The earlier rulings the office found for this shape of decision. */
function PrecedentBlock({ context }: { context: ApprovalContext }) {
  const { precedent, guidance } = context;
  return (
    <section className="mt-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Precedent</p>
      <p className="mt-2 text-sm">{guidance}</p>
      {precedent.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No earlier decision on these terms is on record, so this one is new.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {precedent.map((entry) => (
            <li key={entry.episodeId} className="rounded-lg border border-border px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{entry.actionKind.replaceAll("_", " ")}</p>
                <Badge variant={entry.outcome === "approved" ? "ok" : "danger"}>
                  {entry.outcome}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted">
                {formatDate(entry.decidedAt)} · {similarityLabel(entry.similarity)}
              </p>
              {entry.difference ? (
                <p className="mt-2 text-sm">
                  <span className="text-muted">What differs: </span>
                  {entry.difference}
                </p>
              ) : null}
              <p className="mt-1 text-sm">
                <span className="text-muted">What it means here: </span>
                {effectLabel(entry.effect)}
              </p>
              {entry.reasoning ? (
                <p className="mt-2 border-l-2 border-border pl-3 text-sm text-muted">
                  {entry.reasoning}
                </p>
              ) : null}
              {entry.reasonCode ? (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                  reason code: {entry.reasonCode}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The record the founder writes before an approval that reaches a person. */
function ReasoningForm({
  reasonCodeId,
  reasoningId,
  reasoningCounterId,
  reasoningHintId,
  evidenceId,
  reasonCodes,
  reasonCode,
  reasoning,
  evidenceShown,
  onReasonCode,
  onReasoning,
  onEvidence,
}: {
  reasonCodeId: string;
  reasoningId: string;
  reasoningCounterId: string;
  reasoningHintId: string;
  evidenceId: string;
  reasonCodes: { code: string; label: string }[];
  reasonCode: string;
  reasoning: string;
  evidenceShown: string;
  onReasonCode: (value: string) => void;
  onReasoning: (value: string) => void;
  onEvidence: (value: string) => void;
}) {
  const length = reasoning.trim().length;
  const short = length < MIN_REASONING_CHARS;
  // The office names the codes it will accept. If the context comes back with
  // none, the fixed taxonomy is used rather than leaving the founder with a
  // choice they cannot make.
  const codes = reasonCodes.length > 0 ? reasonCodes : REASON_CODES;
  return (
    <section className="mt-5 rounded-xl border border-warn/30 bg-warn/5 p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-warn">
        Pre-exposure reasoning · required before you approve
      </p>
      <p className="mt-2 text-sm">
        This approval reaches a person, so the office has to be able to explain it later. Write the
        record down <em>before</em> you approve. Rejecting needs none of this — you can refuse a
        thing without justifying it.
      </p>

      <div className="mt-4">
        <Label htmlFor={reasonCodeId}>Reason code</Label>
        <Select
          id={reasonCodeId}
          className="mt-1"
          value={reasonCode}
          onChange={(event) => onReasonCode(event.target.value)}
        >
          <option value="">Choose a reason code…</option>
          {codes.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.label}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-muted">
          The code is fixed, so years of decisions can be counted against each other.
        </p>
      </div>

      <div className="mt-4">
        <Label htmlFor={reasoningId}>
          Your reasoning (at least {MIN_REASONING_CHARS} characters)
        </Label>
        <Textarea
          id={reasoningId}
          className="mt-1"
          rows={4}
          maxLength={2000}
          aria-describedby={`${reasoningCounterId} ${reasoningHintId}`}
          placeholder="What you saw, what you decided, and why you decided it."
          value={reasoning}
          onChange={(event) => onReasoning(event.target.value)}
        />
        <p id={reasoningCounterId} className={`mt-1 text-xs ${short ? "text-warn" : "text-muted"}`}>
          {length} characters written · {MIN_REASONING_CHARS} is the minimum
          {short ? ` · ${MIN_REASONING_CHARS - length} more needed` : " · minimum met"}
        </p>
        <p id={reasoningHintId} className="mt-1 text-xs text-muted">
          Write what a stranger would need to understand this decision in a year, without asking
          you.
        </p>
        {short ? null : (
          <p role="status" className="mt-1 text-xs text-ok">
            The minimum is met. The reasoning can be recorded.
          </p>
        )}
      </div>

      <div className="mt-4">
        <Label htmlFor={evidenceId}>The evidence you were shown</Label>
        <Input
          id={evidenceId}
          className="mt-1"
          maxLength={500}
          placeholder="The record, the figure, or the message that carried the decision."
          value={evidenceShown}
          onChange={(event) => onEvidence(event.target.value)}
        />
        <p className="mt-1 text-xs text-muted">
          What was on the table when you decided, so the same evidence can be read back later.
        </p>
      </div>
    </section>
  );
}
