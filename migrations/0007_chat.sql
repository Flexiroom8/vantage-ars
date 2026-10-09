create table if not exists chat_threads (
  id text primary key,
  name text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id text primary key,
  thread_id text not null,
  role text not null,
  body text not null,
  created_at timestamptz not null default now()
);
