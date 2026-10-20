import * as SwitchPrimitive from "@radix-ui/react-switch";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/office/empty-state";
import { PageHeader } from "@/components/office/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getDelegation, revokeDelegationPolicy, saveDelegationPolicy } from "@/lib/office/api";
import { PUBLISHED_RATES } from "@/lib/office/catalogue";
import { formatDate, formatRelative, formatZar } from "@/lib/office/format";

export const Route = createFileRoute("/office/delegations")({
  loader: () => getDelegation(),
  component: DelegationsPage,
});

/** Only offered published rates may ever be delegated. */
const DELEGATABLE_RATES = PUBLISHED_RATES.filter((rate) => rate.offered);

const ACTION_LABELS: Record<string, string> = {
  open_opportunity: "Open an opportunity",
  issue_quote: "Quote a published rate",
  propose_close_won: "Propose the deal as won",
  issue_invoice: "Issue an invoice",
  record_inbound_payment: "Match a payment to an invoice",
  start_subscription: "Start a monthly subscription",
  cancel_subscription: "End a monthly subscription",
  fulfil_service: "Deliver a productised service",
  send_customer_mail: "Email the customer",
};

const ACTION_HINTS: Record<string, string> = {
  open_opportunity: "Record a company that actually contacted the office.",
  issue_quote: "Price the work from the published card and nothing else.",
  propose_close_won: "Tell the office the customer accepted the quote.",
  issue_invoice: "Bill a customer whose work was accepted.",
  record_inbound_payment: "Match an exact payment notice to an open invoice.",
  start_subscription: "Begin a managed monthly plan on a won opportunity.",
  cancel_subscription: "End a managed monthly plan.",
  fulfil_service: "Produce a productised service from our own records.",
  send_customer_mail: "Email the customer without asking first.",
};

type Delegation = {
  id: string;
  label: string;
  status: "active" | "paused" | "revoked";
  maxAmountCents: number;
  maxActionsPerDay: number;
  maxActionsPerMonth: number;
  allowedActions: string[];
  allowedRateIds: string[];
  allowCustomerMail: boolean;
  allowAutoReconcile: boolean;
  requireAcceptedQuote: boolean;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};

type Preset = {
  id: string;
  label: string;
  summary: string;
  allowedActions: string[];
  allowCustomerMail: boolean;
  allowAutoReconcile: boolean;
  requireAcceptedQuote: boolean;
};

type Usage = {
  usedToday: number;
  usedThisMonth: number;
  spentTodayCents: number;
  spentThisMonthCents: number;
};

const EMPTY_USAGE: Usage = {
  usedToday: 0,
  usedThisMonth: 0,
  spentTodayCents: 0,
  spentThisMonthCents: 0,
};

type FormState = {
  label: string;
  status: "active" | "paused";
  maxAmountRand: string;
  maxActionsPerDay: string;
  maxActionsPerMonth: string;
  allowedActions: string[];
  allowedRateIds: string[];
  allowCustomerMail: boolean;
  allowAutoReconcile: boolean;
  requireAcceptedQuote: boolean;
};

function DelegationsPage() {
  const data = Route.useLoaderData();
  const delegation = data.delegation;
  const usage = data.usage ?? EMPTY_USAGE;

  return (
    <div className="enter-up mx-auto max-w-5xl">
      <PageHeader
        kicker="Delegated authority · ART-13"
        title="Say it once, in advance."
        description="A standing delegation is a bounded, revocable authority. Inside it the office delivers productised services, invoices recurring customers, emails them, and matches payments without stopping for you. Outside it, the office still stops at the founder gate for everything."
      />

      {delegation ? (
        <div className="space-y-6">
          <DelegationSummary delegation={delegation} usage={usage} />
          <DelegationForm
            key={delegation.updatedAt}
            delegation={delegation}
            presets={data.presets}
            delegatableActions={data.delegatableActions}
          />
          <RevokePanel delegation={delegation} />
        </div>
      ) : (
        <div className="space-y-6">
          <EmptyState
            title="Nothing is delegated"
            body="No standing delegation exists. The office still stops at the founder gate for every cost, every customer win, every customer loss, and every marketing-to-sales handoff."
          />
          <DelegationForm
            delegation={null}
            presets={data.presets}
            delegatableActions={data.delegatableActions}
          />
        </div>
      )}

      <Explainer />
    </div>
  );
}

function DelegationSummary({ delegation, usage }: { delegation: Delegation; usage: Usage }) {
  const revoked = delegation.status === "revoked";
  const rateTitles = DELEGATABLE_RATES.filter((rate) =>
    delegation.allowedRateIds.includes(rate.id),
  );

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted">Standing delegation</p>
          <h2 className="mt-1 font-serif text-2xl">{delegation.label}</h2>
          <p className="mt-1 text-xs text-muted">
            Granted {formatDate(delegation.createdAt)} · updated{" "}
            {formatRelative(delegation.updatedAt)}
          </p>
        </div>
        <Badge variant={revoked ? "danger" : delegation.status === "paused" ? "warn" : "ok"}>
          {delegation.status}
        </Badge>
      </div>

      {revoked ? (
        <p className="mt-4 border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          This delegation was revoked
          {delegation.revokedAt ? ` on ${formatDate(delegation.revokedAt)}` : ""}. It no longer
          authorises anything. Saving the policy below grants a fresh one.
        </p>
      ) : null}

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted">Most per action</dt>
          <dd className="mt-1 font-mono tabular-nums">{formatZar(delegation.maxAmountCents)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted">Actions per day</dt>
          <dd className="mt-1 font-mono tabular-nums">{delegation.maxActionsPerDay}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-muted">Actions per month</dt>
          <dd className="mt-1 font-mono tabular-nums">{delegation.maxActionsPerMonth}</dd>
        </div>
      </dl>

      <section className="mt-6">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          Delegated action kinds
        </h3>
        {delegation.allowedActions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            None. Everything still stops at the founder gate.
          </p>
        ) : (
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {delegation.allowedActions.map((action) => (
              <li key={action} className="text-sm">
                {ACTION_LABELS[action] ?? action.replaceAll("_", " ")}
                <span className="ml-2 font-mono text-[10px] text-subtle">{action}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          Rate lines it may charge
        </h3>
        {rateTitles.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No published rate line is delegated. The office may not bill under this delegation.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {rateTitles.map((rate) => (
              <li key={rate.id} className="flex items-baseline justify-between gap-4 py-1.5">
                <span className="text-sm">{rate.title}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                  {rate.price}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Switches</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <SwitchChip label="Customer email" on={delegation.allowCustomerMail} />
          <SwitchChip label="Automatic payment matching" on={delegation.allowAutoReconcile} />
          <SwitchChip label="Accepted quote required" on={delegation.requireAcceptedQuote} />
        </div>
      </section>

      <section className="mt-5 border-t border-border pt-4">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Usage</h3>
        <p aria-live="polite" className="mt-2 text-sm">
          Used <span className="font-mono tabular-nums">{usage.usedToday}</span> of{" "}
          <span className="font-mono tabular-nums">{delegation.maxActionsPerDay}</span> today,{" "}
          <span className="font-mono tabular-nums">{usage.usedThisMonth}</span> of{" "}
          <span className="font-mono tabular-nums">{delegation.maxActionsPerMonth}</span> this
          month.
        </p>
        <p className="mt-1 text-sm text-muted">
          Rand used:{" "}
          <span className="font-mono tabular-nums">{formatZar(usage.spentTodayCents)}</span> today ·{" "}
          <span className="font-mono tabular-nums">{formatZar(usage.spentThisMonthCents)}</span>{" "}
          this month.
        </p>
      </section>
    </Card>
  );
}

function SwitchChip({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="rounded-lg bg-raised px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-sm font-medium ${on ? "text-ok" : "text-subtle"}`}>
        {on ? "On" : "Off"}
      </p>
    </div>
  );
}

function DelegationForm({
  delegation,
  presets,
  delegatableActions,
}: {
  delegation: Delegation | null;
  presets: Preset[];
  delegatableActions: readonly string[];
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => formStateFrom(delegation));
  const [presetId, setPresetId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const amountCents = Math.round(Number(state.maxAmountRand) * 100);

  function applyPreset(preset: Preset) {
    setPresetId(preset.id);
    setError("");
    setState((previous) => ({
      ...previous,
      label: preset.label,
      allowedActions: [...preset.allowedActions],
      allowCustomerMail: preset.allowCustomerMail,
      allowAutoReconcile: preset.allowAutoReconcile,
      requireAcceptedQuote: preset.requireAcceptedQuote,
    }));
  }

  function toggleAction(action: string, checked: boolean) {
    setState((previous) => {
      const allowedActions = checked
        ? [...previous.allowedActions, action]
        : previous.allowedActions.filter((item) => item !== action);
      const next = { ...previous, allowedActions };
      if (action === "send_customer_mail") {
        next.allowCustomerMail = checked ? true : previous.allowCustomerMail;
      }
      return next;
    });
  }

  function toggleRate(rateId: string, checked: boolean) {
    setState((previous) => ({
      ...previous,
      allowedRateIds: checked
        ? [...previous.allowedRateIds, rateId]
        : previous.allowedRateIds.filter((item) => item !== rateId),
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const result = await saveDelegationPolicy({
        data: {
          label: state.label,
          status: state.status,
          maxAmountCents: amountCents,
          maxActionsPerDay: Number(state.maxActionsPerDay),
          maxActionsPerMonth: Number(state.maxActionsPerMonth),
          allowedActions: state.allowedActions,
          allowedRateIds: state.allowedRateIds,
          allowCustomerMail: state.allowCustomerMail,
          allowAutoReconcile: state.allowAutoReconcile,
          requireAcceptedQuote: state.requireAcceptedQuote,
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Delegation saved. It is written into the audit chain.");
      await router.invalidate();
    } catch {
      setError("The delegation could not be saved. Nothing was changed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted">
            {delegation ? "Edit the delegation" : "Grant a delegation"}
          </p>
          <h2 className="mt-1 font-serif text-2xl">
            {delegation ? "Change the envelope" : "Say what the office may do"}
          </h2>
        </div>
      </div>

      {delegation?.status === "revoked" ? (
        <p className="mt-4 border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">
          This delegation is revoked and authorises nothing. Saving the policy below grants a fresh
          one, active from the next action.
        </p>
      ) : null}

      {!delegation ? (
        <section className="mt-5">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            Start from a preset
          </h3>
          <p className="mt-1 text-sm text-muted">
            A preset only fills the form. Nothing is delegated until you save it.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={presetId === preset.id}
                onClick={() => applyPreset(preset)}
                className={`rounded-xl bg-raised p-4 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 ${
                  presetId === preset.id
                    ? "shadow-[var(--shadow-border-hover)] ring-1 ring-accent"
                    : "shadow-[var(--shadow-border)]"
                }`}
              >
                <p className="text-sm font-medium">{preset.label}</p>
                <p className="mt-1 text-sm text-muted">{preset.summary}</p>
                {preset.allowedActions.length > 0 ? (
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                    {preset.allowedActions.length} delegated action
                    {preset.allowedActions.length === 1 ? "" : "s"}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <form className="mt-6 space-y-5" noValidate onSubmit={(event) => void onSubmit(event)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="delegation-label">Name of the delegation</Label>
            <Input
              id="delegation-label"
              className="mt-1"
              value={state.label}
              maxLength={120}
              placeholder="Managed revenue — October"
              onChange={(event) =>
                setState((previous) => ({ ...previous, label: event.target.value }))
              }
            />
            <p className="mt-1 text-xs text-muted">
              Something you will recognise in the audit chain. At least three characters.
            </p>
          </div>

          <div>
            <Label htmlFor="delegation-status">Status</Label>
            <Select
              id="delegation-status"
              className="mt-1"
              value={state.status}
              onChange={(event) =>
                setState((previous) => ({
                  ...previous,
                  status: event.target.value === "paused" ? "paused" : "active",
                }))
              }
            >
              <option value="active">Active — the office may act</option>
              <option value="paused">Paused — nothing runs until you resume it</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="delegation-amount">Most per single action (R)</Label>
            <Input
              id="delegation-amount"
              className="mt-1"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={state.maxAmountRand}
              onChange={(event) =>
                setState((previous) => ({ ...previous, maxAmountRand: event.target.value }))
              }
            />
            <p className="mt-1 text-xs text-muted">
              That is{" "}
              <span className="font-mono tabular-nums">
                {Number.isFinite(amountCents) && amountCents > 0 ? formatZar(amountCents) : "—"}
              </span>{" "}
              per action.
            </p>
          </div>

          <div>
            <Label htmlFor="delegation-per-day">Actions per day</Label>
            <Input
              id="delegation-per-day"
              className="mt-1"
              type="number"
              inputMode="numeric"
              step="1"
              value={state.maxActionsPerDay}
              onChange={(event) =>
                setState((previous) => ({ ...previous, maxActionsPerDay: event.target.value }))
              }
            />
          </div>

          <div>
            <Label htmlFor="delegation-per-month">Actions per month</Label>
            <Input
              id="delegation-per-month"
              className="mt-1"
              type="number"
              inputMode="numeric"
              step="1"
              value={state.maxActionsPerMonth}
              onChange={(event) =>
                setState((previous) => ({ ...previous, maxActionsPerMonth: event.target.value }))
              }
            />
            <p className="mt-1 text-xs text-muted">Cannot be smaller than the daily limit.</p>
          </div>
        </div>

        <fieldset>
          <legend className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            Delegated action kinds
          </legend>
          <p className="mt-1 text-sm text-muted">
            Tick only what the office may do on its own. Everything unticked still stops at the
            founder gate.
          </p>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {delegatableActions.map((action) => {
              const id = `delegation-action-${action}`;
              return (
                <li key={action} className="flex items-start gap-3 px-4 py-3">
                  <input
                    id={id}
                    type="checkbox"
                    className="mt-1 size-4 accent-[var(--color-accent)]"
                    checked={state.allowedActions.includes(action)}
                    onChange={(event) => toggleAction(action, event.target.checked)}
                  />
                  <label htmlFor={id} className="cursor-pointer">
                    <span className="block text-sm">
                      {ACTION_LABELS[action] ?? action.replaceAll("_", " ")}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {ACTION_HINTS[action] ?? ""}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <fieldset>
          <legend className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            Rate lines it may charge
          </legend>
          <p className="mt-1 text-sm text-muted">
            Only the published card may be charged, and only the lines ticked here. A rate that is
            not published can never be delegated.
          </p>
          <ul className="mt-3 max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {DELEGATABLE_RATES.map((rate) => {
              const id = `delegation-rate-${rate.id}`;
              return (
                <li key={rate.id} className="flex items-start gap-3 px-4 py-3">
                  <input
                    id={id}
                    type="checkbox"
                    className="mt-1 size-4 accent-[var(--color-accent)]"
                    checked={state.allowedRateIds.includes(rate.id)}
                    onChange={(event) => toggleRate(rate.id, event.target.checked)}
                  />
                  <label htmlFor={id} className="flex-1 cursor-pointer">
                    <span className="block text-sm">{rate.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">{rate.scope}</span>
                  </label>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                    {rate.price}
                  </span>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <fieldset className="space-y-3 rounded-xl border border-border p-4">
          <legend className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            Switches
          </legend>
          <Toggle
            id="delegation-mail"
            label="Customer email"
            hint="The office may email a customer without asking you first."
            checked={state.allowCustomerMail}
            onCheckedChange={(checked) =>
              setState((previous) => ({
                ...previous,
                allowCustomerMail: checked,
                allowedActions: checked
                  ? previous.allowedActions
                  : previous.allowedActions.filter((action) => action !== "send_customer_mail"),
              }))
            }
          />
          <Toggle
            id="delegation-reconcile"
            label="Automatic payment matching"
            hint="An exact payment notice may be matched to an open invoice without you."
            checked={state.allowAutoReconcile}
            onCheckedChange={(checked) =>
              setState((previous) => ({ ...previous, allowAutoReconcile: checked }))
            }
          />
          <Toggle
            id="delegation-quote"
            label="Accepted quote required"
            hint="On: the office may only act for a customer who has already accepted a quote."
            checked={state.requireAcceptedQuote}
            onCheckedChange={(checked) =>
              setState((previous) => ({ ...previous, requireAcceptedQuote: checked }))
            }
          />
        </fieldset>

        {error ? (
          <p
            role="alert"
            className="border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : delegation ? "Save the delegation" : "Grant the delegation"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function RevokePanel({ delegation }: { delegation: Delegation }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [revoking, setRevoking] = useState(false);
  const revoked = delegation.status === "revoked";

  async function onRevoke() {
    setError("");
    setRevoking(true);
    try {
      const result = await revokeDelegationPolicy({
        data: { reason: reason.trim() || "Revoked by the founder." },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Delegation revoked. It took effect on the very next action.");
      await router.invalidate();
    } catch {
      setError("The delegation could not be revoked. Check the audit chain before retrying.");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <Card className="border-danger/30">
      <p className="font-mono text-[11px] tracking-[0.16em] text-danger">Revoke</p>
      <h2 className="mt-1 font-serif text-2xl">Take the authority back.</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Revoking takes effect on the very next action the office would take. There is no grace
        period, no queued work that survives it, and no auto-approval waiting to fire: an approval
        you never answer is skipped, never granted.
      </p>
      {revoked ? (
        <p className="mt-4 text-sm text-muted">
          This delegation is already revoked
          {delegation.revokedAt ? `, on ${formatDate(delegation.revokedAt)}` : ""}. Nothing runs
          under it.
        </p>
      ) : (
        <>
          <Label htmlFor="delegation-revoke-reason" className="mt-5 block">
            Reason for the audit chain
          </Label>
          <Textarea
            id="delegation-revoke-reason"
            className="mt-1"
            rows={2}
            maxLength={400}
            value={reason}
            placeholder="We are winding the managed plans down at the end of the month."
            onChange={(event) => setReason(event.target.value)}
          />
          {error ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="mt-4">
            <Button variant="danger" disabled={revoking} onClick={() => void onRevoke()}>
              {revoking ? "Revoking…" : "Revoke the delegation now"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id} className="normal-case tracking-normal">
          {label}
        </Label>
        <p className="mt-1 text-xs text-muted">{hint}</p>
      </div>
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-raised shadow-[var(--shadow-border)] transition-colors data-[state=checked]:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
      >
        <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-surface shadow transition-transform data-[state=checked]:translate-x-5" />
      </SwitchPrimitive.Root>
    </div>
  );
}

function Explainer() {
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-serif text-2xl">What this means, in plain words</h2>
      <Card>
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-medium">It can act, inside the envelope you set.</dt>
            <dd className="mt-1 text-muted">
              Fulfil a productised service, invoice a customer whose work was accepted, email that
              customer, and match an exact payment to an open invoice — until the daily or monthly
              cap is reached, or the amount of the single action is over the limit you set.
            </dd>
          </div>
          <div>
            <dt className="font-medium">It cannot widen what the office is allowed to do.</dt>
            <dd className="mt-1 text-muted">
              It cannot move an agent outside its role, cannot permit a price that is not on the
              published card, cannot permit a promise to a customer, and cannot survive a halt. A
              delegation never overrides a hard block — it only answers the founder gate in advance,
              for the class of action you named.
            </dd>
          </div>
          <div>
            <dt className="font-medium">It is written down.</dt>
            <dd className="mt-1 text-muted">
              Every action taken under the delegation is recorded in the audit chain against the
              delegation that allowed it, with the check that permitted it and the amount it moved.
              You can read back which delegation authorised what.
            </dd>
          </div>
          <div>
            <dt className="font-medium">An approval you never answer is skipped, not granted.</dt>
            <dd className="mt-1 text-muted">
              The office does not read silence as consent. There is no clock that turns an
              unanswered approval into an approval, so anything the founder has not answered stays
              unapproved and the work waits.
            </dd>
          </div>
        </dl>
      </Card>
    </section>
  );
}

function formStateFrom(delegation: Delegation | null): FormState {
  if (delegation) {
    return {
      label: delegation.label,
      status: delegation.status === "paused" ? "paused" : "active",
      maxAmountRand: (delegation.maxAmountCents / 100).toFixed(2),
      maxActionsPerDay: String(delegation.maxActionsPerDay),
      maxActionsPerMonth: String(delegation.maxActionsPerMonth),
      allowedActions: [...delegation.allowedActions],
      allowedRateIds: [...delegation.allowedRateIds],
      allowCustomerMail: delegation.allowCustomerMail,
      allowAutoReconcile: delegation.allowAutoReconcile,
      requireAcceptedQuote: delegation.requireAcceptedQuote,
    };
  }
  return {
    label: "",
    status: "active",
    maxAmountRand: "5000.00",
    maxActionsPerDay: "20",
    maxActionsPerMonth: "200",
    allowedActions: [],
    allowedRateIds: DELEGATABLE_RATES.map((rate) => rate.id),
    allowCustomerMail: false,
    allowAutoReconcile: false,
    requireAcceptedQuote: true,
  };
}
