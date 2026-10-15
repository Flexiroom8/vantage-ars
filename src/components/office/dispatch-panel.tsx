import { useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dispatchAgent } from "@/lib/office/api";
import { AGENT_DEFS } from "@/lib/office/agents";
import { cn } from "@/lib/utils";

export function DispatchPanel({
  defaultAgent = "vantage",
  lockedAgent,
  placeholder,
}: {
  defaultAgent?: string;
  lockedAgent?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const [agentId, setAgentId] = useState(lockedAgent ?? defaultAgent);
  const [task, setTask] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await dispatchAgent({ data: { agentId, task } });
      if (!result.ok) {
        toast.error(result.error ?? "Dispatch failed.");
        return;
      }
      toast.success(
        `${result.executed} executed · ${result.escalated} to you · ${result.blocked} blocked`,
        { description: result.briefing },
      );
      setTask("");
      await router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dispatch failed.");
    } finally {
      setPending(false);
    }
  }

  const agents = lockedAgent ? AGENT_DEFS.filter((a) => a.id === lockedAgent) : AGENT_DEFS;

  return (
    <form onSubmit={onSubmit} className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Dispatch</p>
        <p className="mt-1 font-serif text-2xl text-fg">Brief the office</p>
      </div>
      {!lockedAgent ? (
        <div className="mb-3">
          <Label htmlFor="agent">Agent</Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => setAgentId(agent.id)}
                aria-pressed={agentId === agent.id}
                className={cn(
                  "h-9 rounded-md px-3 text-xs tracking-wide uppercase transition-colors duration-150",
                  agentId === agent.id
                    ? "bg-accent text-accent-fg"
                    : "bg-raised text-muted hover:text-fg",
                )}
              >
                {agent.callsign}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <Label htmlFor="task">Brief</Label>
      <Textarea
        id="task"
        className="mt-2"
        value={task}
        onChange={(event) => setTask(event.target.value)}
        placeholder={
          placeholder ??
          "e.g. Route today’s inbound, draft an organic launch note for vantage-ars.co.za, and flag anything that needs my approval."
        }
        required
        minLength={8}
      />
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Evaluating…" : "Run within constitution"}
        </Button>
      </div>
    </form>
  );
}
