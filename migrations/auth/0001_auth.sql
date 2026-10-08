-- Better Auth schema (PostgreSQL). Opt-in: this directory is NOT applied
-- by the preview bootstrap (the migration glob does not descend); apply it
-- with `npm run db:migrate --auth` when local email/password sign-in is
-- enabled (see src/lib/auth/email-password.ts).

create table if not exists "user" (
  "id" text primary key not null,
  "name" text not null,
  "email" text not null,
  "email_verified" boolean not null default false,
  "image" text,
  "created_at" timestamp not null,
  "updated_at" timestamp not null
);

create table if not exists "session" (
  "id" text primary key not null,
  "expires_at" timestamp not null,
  "token" text not null,
  "created_at" timestamp not null,
  "updated_at" timestamp not null,
  "ip_address" text,
  "user_agent" text,
  "user_id" text not null references "user"(id) on delete cascade
);

create unique index if not exists "session_token_index" on "session"("token");

create table if not exists "account" (
  "id" text primary key not null,
  "account_id" text not null,
  "provider_id" text not null,
  "user_id" text not null references "user"(id) on delete cascade,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp not null,
  "updated_at" timestamp not null
);

create unique index if not exists "account_provider_id_account_id_key" on "account"("provider_id", "account_id");

create table if not exists "verification" (
  "id" text primary key not null,
  "identifier" text not null,
  "value" text not null,
  "expires_at" timestamp not null,
  "created_at" timestamp,
  "updated_at" timestamp
);

create table if not exists "authenticator" (
  "id" text primary key not null,
  "credential_id" text not null,
  "provider_id" text not null,
  "user_id" text not null references "user"(id) on delete cascade,
  "counter" integer not null,
  "public_key" text not null,
  "aaguid" text not null default '00000000-0000-0000-0000-000000000000',
  "transports" text,
  "backupable" boolean,
  "created_at" timestamp not null,
  "updated_at" timestamp not null
);

create unique index if not exists "authenticator_credential_id_key" on "authenticator"("credential_id");
