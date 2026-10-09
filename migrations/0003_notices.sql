create table if not exists founder_notices (
  id text primary key,
  kind text not null,
  subject text not null,
  status text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create index if not exists founder_notices_created_idx on founder_notices (created_at desc);
