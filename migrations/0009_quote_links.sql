-- Customer quote links: a private, expiring URL where the customer reads the
-- approved quote and records their own acceptance or decline. Only a SHA-256
-- hash of the link token is stored.
create table if not exists quote_links (
  id text primary key,
  token_hash text not null unique,
  document_id text not null,
  opportunity_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0,
  answered_at timestamptz,
  answer text,
  answer_name text,
  answer_note text
);

create index if not exists quote_links_document_idx on quote_links (document_id);
