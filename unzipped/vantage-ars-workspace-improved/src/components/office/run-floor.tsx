import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runFloor } from "@/lib/office/api";

export function RunFloorButton({ halted }: { halted: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onRun() {
    setPending(true);
    try {
      const result = await runFloor();
      if (!result.ok) {
        toast.error(result.error ?? "The floor could not run.");
        return;
      }
      toast.success(
        `${result.executed} executed · ${result.escalated} to you · ${result.blocked} blocked`,
        { description: result.briefing },
      );
      await router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The floor could not run.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="secondary" onClick={onRun} disabled={pending || halted}>
      {pending ? "Evaluating…" : "Run the floor"}
    </Button>
  );
}
