import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useOfficeSnapshot } from "@/components/office/office-context";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { DispatchPanel } from "@/components/office/dispatch-panel";
import { EmptyState } from "@/components/office/empty-state";
import { PageHeader } from "@/components/office/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitInbound } from "@/lib/office/api";
import { formatDateTime } from "@/lib/office/money";

export const Route = createFileRoute("/office/inbox")({
  component: InboxPage,
});

const CHANNELS = ["email", "phone", "web", "walk-in", "referral", "direct"] as const;
const INTENTS = [
  "enquiry",
  "sales_interest",
  "support",
  "billing",
  "partnership",
  "other",
] as const;

function InboxPage() {
  const snapshot = useOfficeSnapshot();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    channel: "email",
    companyName: "",
    subject: "",
    summary: "",
    intent: "enquiry",
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await submitInbound({ data: form });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.routed) {
        toast.success(
          `FOYER routed · ${result.executed ?? 0} executed · ${result.escalated ?? 0} to you`,
          { description: result.briefing },
        );
      } else {
        toast.success("Logged. Reception will take it when the office is live.");
      }
      setForm({ ...form, companyName: "", subject: "", summary: "" });
      await router.invalidate();
    } catch {
      // Without this a dropped request or a 5xx re-enabled the form silently,
      // so the founder could not tell the inbound was never filed.
      toast.error("The inbound could not be filed. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="enter-up mx-auto max-w-5xl">
      <PageHeader
        kicker="Reception · FOYER"
        title="Inbound stops at the desk first."
        description="Website enquiries are filed here on their own. Reception drafts an acknowledgement and does not send it. A request to buy stops for your approval before Sales."
      />
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h2 className="font-serif text-2xl">Log inbound</h2>
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="companyName">Company</Label>
              <Input
                id="companyName"
                className="mt-2"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="channel">Channel</Label>
                <Select
                  id="channel"
                  className="mt-2"
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                >
                  {CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="intent">Intent</Label>
                <Select
                  id="intent"
                  className="mt-2"
                  value={form.intent}
                  onChange={(e) => setForm({ ...form, intent: e.target.value })}
                >
                  {INTENTS.map((intent) => (
                    <option key={intent} value={intent}>
                      {intent.replaceAll("_", " ")}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                className="mt-2"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="summary">Summary</Label>
              <Textarea
                id="summary"
                className="mt-2"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                required
              />
            </div>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "FOYER evaluating…" : "File and route"}
            </Button>
          </form>
        </Card>
        <div className="space-y-4">
          <DispatchPanel
            lockedAgent="foyer"
            placeholder="Re-route open inbound. Create leads only for genuine demand. Do not sell."
          />
          {snapshot.documents.filter((doc) => doc.kind === "correspondence").length > 0 ? (
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted">Unsent drafts</p>
              <ul className="space-y-2">
                {snapshot.documents
                  .filter((doc) => doc.kind === "correspondence")
                  .map((doc) => (
                    <li
                      key={doc.id}
                      className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm">{doc.title}</p>
                        <Badge variant="warn">{doc.status}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted">{doc.summary}</p>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
          {snapshot.inbound.length === 0 ? (
            <EmptyState
              title="No inbound yet"
              body="A website enquiry lands here already filed. Nothing is invented."
            />
          ) : (
            <ul className="space-y-2">
              {snapshot.inbound.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-fg">{item.subject}</p>
                      <p className="text-xs text-muted">
                        {item.companyName} · {item.channel} · {item.intent} ·{" "}
                        {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                    <Badge variant={item.status === "routed" ? "ok" : "default"}>
                      {item.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted">{item.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
