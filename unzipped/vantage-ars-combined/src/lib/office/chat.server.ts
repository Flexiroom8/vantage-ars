import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { chatName, officeChatReply } from "./chat";
import { ensureOffice } from "./store.server";

const THREAD = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ChatLine = { id: string; role: "customer" | "office" | "founder"; body: string; createdAt: string };

async function ensureChat(): Promise<void> {
  await ensureOffice();
  const sql = await getSql();
  await sql`
    create table if not exists chat_threads (
      id text primary key,
      name text not null,
      status text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists chat_messages (
      id text primary key,
      thread_id text not null,
      role text not null,
      body text not null,
      created_at timestamptz not null default now()
    )
  `;
}

function line(row: Record<string, unknown>): ChatLine {
  const role = row.role === "founder" || row.role === "office" ? row.role : "customer";
  return {
    id: String(row.id),
    role,
    body: String(row.body),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function readChat(threadId: string): Promise<ChatLine[]> {
  if (!THREAD.test(threadId)) return [];
  await ensureChat();
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select id, role, body, created_at from chat_messages
    where thread_id = ${threadId}
    order by created_at asc
    limit 80
  `;
  return rows.map(line);
}

export async function postChat(input: {
  threadId: string;
  name: string;
  body: string;
}): Promise<{ ok: true; messages: ChatLine[]; first: boolean } | { ok: false; error: string }> {
  if (!THREAD.test(input.threadId)) return { ok: false, error: "Open the chat again." };
  const name = chatName(input.name);
  if (!name) return { ok: false, error: "Enter the name we should use." };
  const body = input.body.replace(/\s+/g, " ").trim();
  if (body.length < 1 || body.length > 1000) return { ok: false, error: "Write a short message." };
  await ensureChat();
  const sql = await getSql();
  const existing = await sql<{ id: string }>`select id from chat_threads where id = ${input.threadId}`;
  const first = existing.length === 0;
  if (first) {
    await sql`
      insert into chat_threads (id, name, status)
      values (${input.threadId}, ${name}, 'open')
    `;
  } else {
    await sql`update chat_threads set name = ${name}, updated_at = now() where id = ${input.threadId}`;
  }
  const reply = officeChatReply(body);
  await sql`
    insert into chat_messages (id, thread_id, role, body)
    values (${randomUUID()}, ${input.threadId}, 'customer', ${body})
  `;
  await sql`
    insert into chat_messages (id, thread_id, role, body)
    values (${randomUUID()}, ${input.threadId}, 'office', ${reply})
  `;
  await sql`update chat_threads set updated_at = now() where id = ${input.threadId}`;
  return { ok: true, messages: await readChat(input.threadId), first };
}

export async function listChats(): Promise<{ id: string; name: string; updatedAt: string; preview: string }[]> {
  await ensureChat();
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select t.id, t.name, t.updated_at,
      (select body from chat_messages m where m.thread_id = t.id order by m.created_at desc limit 1) as preview
    from chat_threads t
    order by t.updated_at desc
    limit 40
  `;
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    preview: String(row.preview ?? ""),
  }));
}

export async function founderReply(threadId: string, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!THREAD.test(threadId)) return { ok: false, error: "That chat is not open." };
  const text = body.replace(/\s+/g, " ").trim();
  if (text.length < 1 || text.length > 1000) return { ok: false, error: "Write a short reply." };
  await ensureChat();
  const sql = await getSql();
  const existing = await sql<{ id: string }>`select id from chat_threads where id = ${threadId}`;
  if (!existing.length) return { ok: false, error: "That chat is not open." };
  await sql`
    insert into chat_messages (id, thread_id, role, body)
    values (${randomUUID()}, ${threadId}, 'founder', ${text})
  `;
  await sql`update chat_threads set updated_at = now() where id = ${threadId}`;
  return { ok: true };
}
