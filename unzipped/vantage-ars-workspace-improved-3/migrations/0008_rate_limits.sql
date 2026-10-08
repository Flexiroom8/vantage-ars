create table if not exists rate_hits (
  bucket text not null,
  key text not null,
  window_start bigint not null,
  hits integer not null default 0,
  primary key (bucket, key, window_start)
);

create index if not exists rate_hits_window_idx on rate_hits (window_start);
