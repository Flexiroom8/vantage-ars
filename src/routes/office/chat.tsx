import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/office/empty-state";
import { PageHeader } from "@/components/office/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listOfficeChats, readPublicChat, replyOfficeChat } from "@/lib/office/api";

export const Route = createFileRoute("/office/chat")({
  component: ChatDesk,
});

type Thread = { id: string; name: string; preview: string };
type Line = { id: string; role: string; body: string };

function ChatDesk() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  async function loadThreads() {
    const rows = await listOfficeChats();
    setThreads(rows);
    setActive((current) => current ?? rows[0]?.id ?? null);
  }

  useEffect(() => {
    void loadThreads().catch(() => toast.error("The chats could not be loaded."));
  }, []);

  useEffect(() => {
    if (!active) return;
    let stop = false;
    async function pull() {
      const result = await readPublicChat({ data: { threadId: active as string } });
      if (!stop && result.ok) setLines(result.messages);
    }
    void pull();
    const timer = window.setInterval(() => void pull(), 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [active]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!active) return;
    setPending(true);
    try {
      const result = await replyOfficeChat({ data: { threadId: active, body: draft } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDraft("");
      const next = await readPublicChat({ data: { threadId: active } });
      if (next.ok) setLines(next.messages);
    } catch {
      toast.error("The reply could not be sent.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="enter-up mx-auto max-w-5xl">
      <PageHeader
        kicker="Reception · FOYER"
        title="Live chat."
        description="Customers write here. The first reply states the published rate when they ask, and it is not a quote. Your reply is sent into the same chat."
      />
      {threads.length === 0 ? (
        <EmptyState title="No chats" body="Nothing has been said. The public chat stays empty until a customer writes." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <ul className="space-y-2">
            {threads.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => setActive(thread.id)}
                  className="w-full rounded-xl bg-surface px-3 py-3 text-left shadow-[var(--shadow-border)]"
                >
                  <p className="text-sm">{thread.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{thread.preview}</p>
                </button>
              </li>
            ))}
          </ul>
          <section className="flex min-h-80 flex-col rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <div className="flex-1 space-y-3">
              {lines.map((line) => (
                <p key={line.id} className="text-sm">
                  <span className="text-xs uppercase tracking-[0.14em] text-muted">
                    {line.role === "customer" ? "Customer" : line.role === "founder" ? "You" : "Office"}
                  </span>
                  <span className="mt-1 block">{line.body}</span>
                </p>
              ))}
            </div>
            <form onSubmit={(event) => void onSubmit(event)} className="mt-4 flex gap-2">
              <Input value={draft} maxLength={1000} placeholder="Reply in the chat" onChange={(event) => setDraft(event.target.value)} />
              <Button type="submit" disabled={pending || !active}>
                {pending ? "Sending…" : "Send"}
              </Button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
