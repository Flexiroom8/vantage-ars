export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl bg-raised px-5 py-10 text-center shadow-[var(--shadow-border)]">
      <p className="font-serif text-2xl text-fg">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
    </div>
  );
}
