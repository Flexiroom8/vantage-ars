import { useRouterState } from "@tanstack/react-router";
import { MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postPublicChat, readPublicChat } from "@/lib/office/api";
import {
  PUBLIC_CHAT_IDLE_INTERVAL_MS,
  PUBLIC_CHAT_INTERVAL_MS,
  useChatPolling,
} from "@/lib/chat-polling";

type Line = { id: string; role: "customer" | "office" | "founder"; body: string };

const THREAD_KEY = "vantage-chat-thread";
const NAME_KEY = "vantage-chat-name";

function threadId(): string {
  const existing = localStorage.getItem(THREAD_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(THREAD_KEY, id);
  return id;
}

export function PublicChat() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  if (path.startsWith("/office") || path.startsWith("/login")) return null;
  return <ChatPanel />;
}

function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener("vantage-open-chat", openIt);
    return () => window.removeEventListener("vantage-open-chat", openIt);
  }, []);

  useEffect(() => {
    setName(localStorage.getItem(NAME_KEY) ?? "");
  }, []);

  const signature = useRef("");
  useChatPolling({
    enabled: open,
    intervalMs: PUBLIC_CHAT_INTERVAL_MS,
    idleIntervalMs: PUBLIC_CHAT_IDLE_INTERVAL_MS,
    pull: async () => {
      try {
        const result = await readPublicChat({ data: { threadId: threadId() } });
        if (!result.ok) {
          setError(result.error);
          return false;
        }
        setError(null);
        const next = result.messages.map((message) => `${message.id}:${message.createdAt}`).join("|");
        if (next === signature.current) return false;
        signature.current = next;
        setLines(result.messages);
        return true;
      } catch {
        setError("The chat could not be loaded.");
        return false;
      }
    },
    onChange: () => scroller.current?.scrollTo({ top: scroller.current.scrollHeight }),
  });

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lines, open]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const id = threadId();
    localStorage.setItem(NAME_KEY, name);
    setPending(true);
    setError(null);
    try {
      const result = await postPublicChat({ data: { threadId: id, name, body: draft, website: "" } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLines(result.messages);
      setDraft("");
    } catch {
      setError("The message could not be sent.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="site fixed bottom-4 left-4 z-40">
      {open ? (
        <section
          aria-label="Live chat"
          className="panel mb-3 flex h-[28rem] w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl"
        >
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2.5">
              <LivePulse />
              <div>
                <p className="text-lg font-semibold">Ask us</p>
                <p className="text-xs text-muted">A quote is sent separately.</p>
              </div>
            </div>
            <button type="button" className="text-muted hover:text-fg" aria-label="Close chat" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </button>
          </header>
          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {lines.length === 0 ? (
              <p className="text-sm text-muted">Tell us what is going wrong. We will point you to the next step. A written quote is not sent from this chat.</p>
            ) : null}
            {lines.map((line) => (
              <p
                key={line.id}
                className={
                  line.role === "customer"
                    ? "ml-8 rounded-lg bg-raised px-3 py-2 text-sm"
                    : "mr-8 rounded-lg bg-bg px-3 py-2 text-sm text-muted"
                }
              >
                {line.body}
              </p>
            ))}
          </div>
          <form onSubmit={(event) => void onSubmit(event)} className="space-y-2 border-t border-border p-3">
            <Input
              aria-label="Your name"
              value={name}
              required
              minLength={2}
              maxLength={80}
              placeholder="Your name"
              onChange={(event) => setName(event.target.value)}
            />
            <div className="flex gap-2">
              <Input
                aria-label="Message"
                value={draft}
                required
                maxLength={1000}
                placeholder="Message"
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button type="submit" disabled={pending}>
                {pending ? "…" : "Send"}
              </Button>
            </div>
            {error ? <p className="text-xs text-danger">{error}</p> : null}
          </form>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group fixed bottom-5 left-5 flex cursor-pointer items-center gap-3"
        >
          <span className="relative flex size-12 items-center justify-center">
            <span aria-hidden className="fab-ring absolute inset-0 rounded-full border-2 border-accent/70" />
            <span className="relative flex size-12 items-center justify-center rounded-full bg-accent text-accent-fg shadow-[var(--glow-accent)] transition-transform duration-150 group-hover:scale-105">
              <MessageCircle className="size-5" />
            </span>
          </span>
          <span className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
            Ask us
          </span>
          <span className="sr-only">Open live chat</span>
        </button>
      )}
    </div>
  );
}

function LivePulse() {
  return (
    <span className="relative flex size-2.5 shrink-0">
      <span aria-hidden className="fab-ring absolute inset-0 rounded-full border border-ok/70" />
      <span className="live-dot relative size-2.5 rounded-full bg-ok" />
    </span>
  );
}
