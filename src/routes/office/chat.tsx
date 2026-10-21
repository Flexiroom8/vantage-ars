import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/office/empty-state";
import { PageHeader } from "@/components/office/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listOfficeChats, readOfficeChat, replyOfficeChat } from "@/lib/office/api";
import { safeIntervalMs, useChatPolling } from "@/lib/chat-polling";

export const Route = createFileRoute("/office/chat")({
  component: ChatDesk,
});

type Thread = { id: string; name: string; preview: string };
type Line = { id: string; role: string; body: string; createdAt: string };

function ChatDesk() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listOfficeChats()
      .then((rows) => {
        if (cancelled) return;
        setThreads(rows);
        setActive((current) => current ?? rows[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) toast.error("The chats could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 1,800/hour authenticated: a chat desk should feel live. The helper still
  // pauses on a hidden tab and backs off when nothing changes.
  //
  // `loadToken` is bumped every time the selected thread changes. Both the
  // immediate load below and the poll check it before applying state, so a slow
  // response for the previously selected thread can never repaint the panel with
  // another customer's conversation (which would send a reply into the wrong
  // thread under the wrong context).
  const signatureRef = useRef("");
  const loadTokenRef = useRef(0);

  function applyMessages(token: number, messages: Line[]) {
    if (token !== loadTokenRef.current) return;
    signatureRef.current = messages.map((m) => `${m.id}:${m.createdAt}`).join("|");
    setLines(messages);
  }

  function selectThread(threadId: string) {
    if (threadId === active) return;
    const token = (loadTokenRef.current += 1);
    setActive(threadId);
    setLines([]);
    // A half-written reply belongs to the thread it was typed for; carrying it
    // across could send it to a different customer.
    setDraft("");
    signatureRef.current = "";
    void readOfficeChat({ data: { threadId } })
      .then((result) => applyMessages(token, result.messages))
      .catch(() => toast.error("The chat could not be loaded."));
  }

  useChatPolling({
    enabled: Boolean(active),
    intervalMs: safeIntervalMs(1800),
    idleIntervalMs: safeIntervalMs(1800) * 4,
    pull: async () => {
      if (!active) return false;
      const token = loadTokenRef.current;
      const result = await readOfficeChat({ data: { threadId: active } });
      // The founder switched threads while this request was in flight.
      if (token !== loadTokenRef.current) return false;
      const signature = result.messages
        .map((message) => `${message.id}:${message.createdAt}`)
        .join("|");
      if (signature === signatureRef.current) return false;
      signatureRef.current = signature;
      setLines(result.messages);
      return true;
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "The chat could not be loaded."),
  });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!active) return;
    // Captured now: the reply belongs to the thread selected at submit time.
    const threadId = active;
    const token = loadTokenRef.current;
    setPending(true);
    try {
      const result = await replyOfficeChat({ data: { threadId, body: draft } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDraft("");
      const next = await readOfficeChat({ data: { threadId } });
      if (next.ok) applyMessages(token, next.messages);
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
        <EmptyState
          title="No chats"
          body="Nothing has been said. The public chat stays empty until a customer writes."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <ul className="space-y-2" aria-label="Chats">
            {threads.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => selectThread(thread.id)}
                  aria-current={active === thread.id ? "true" : undefined}
                  className={`w-full rounded-xl px-3 py-3 text-left ${
                    active === thread.id
                      ? "bg-raised shadow-[var(--shadow-border)] ring-1 ring-accent/40"
                      : "bg-surface shadow-[var(--shadow-border)]"
                  }`}
                >
                  <p className="text-sm font-medium">{thread.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{thread.preview}</p>
                </button>
              </li>
            ))}
          </ul>
          <section className="flex min-h-80 flex-col rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <div className="flex-1 space-y-3">
              {lines.length === 0 ? <p className="text-sm text-muted">No messages yet.</p> : null}
              {lines.map((line) => (
                <p key={line.id} className="text-sm">
                  <span className="text-xs uppercase tracking-[0.14em] text-muted">
                    {line.role === "customer"
                      ? "Customer"
                      : line.role === "founder"
                        ? "You"
                        : "Office"}
                  </span>
                  <span className="mt-1 block">{line.body}</span>
                </p>
              ))}
            </div>
            <form onSubmit={(event) => void onSubmit(event)} className="mt-4 flex gap-2">
              <label htmlFor="chat-reply" className="sr-only">
                Reply in the chat
              </label>
              <Input
                id="chat-reply"
                value={draft}
                maxLength={1000}
                placeholder="Reply in the chat"
                required
                onChange={(event) => setDraft(event.target.value)}
              />
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
