-- Support time, recorded by the founder.
--
-- Reports no longer have to estimate remote hours from the number of faults:
-- when time entries exist for the account and period, the report says they
-- are recorded. When none exist, it keeps saying the figure is an estimate.
create table if not exists service_time_entries (
  id text primary key,
  company_name text not null,
  minutes integer not null,
  note text not null,
  worked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists service_time_company_idx
  on service_time_entries (lower(company_name), worked_at desc);
create index if not exists service_time_worked_idx
  on service_time_entries (worked_at desc);
