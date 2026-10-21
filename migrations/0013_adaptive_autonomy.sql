-- 0013_adaptive_autonomy.sql
--
-- The scheduler now chooses a posture from the real state of the office
-- (`idle`, `steady`, `surge`, `recovery`) and records the posture and the
-- drain budget on its own state row. Keeping them here means the founder's
-- autonomy panel reads what the scheduler actually did, rather than guessing
-- from queue counts after the fact.
--
-- Idempotent: safe to re-apply.

alter table office_state add column if not exists last_posture text;
alter table office_state add column if not exists last_budget integer not null default 0;
