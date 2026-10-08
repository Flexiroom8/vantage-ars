import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateTicket } from "@/lib/office/api";

export function TicketActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const next = status === "open" ? "in_progress" : status === "in_progress" ? "resolved" : null;
  if (!next) return null;
  const label = next === "in_progress" ? "Start work" : "Mark resolved";

  async function onClick() {
    setPending(true);
    try {
      const result = await updateTicket({ data: { ticketId: id, status: next as "in_progress" | "resolved" } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(next === "resolved" ? "Resolved. The customer was not emailed." : "Work started. The customer was not emailed.");
      await router.invalidate();
    } catch {
      toast.error("The ticket could not be updated.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => void onClick()}>
      {pending ? "Saving…" : label}
    </Button>
  );
}
