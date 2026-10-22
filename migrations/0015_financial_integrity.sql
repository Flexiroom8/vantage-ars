-- A quote is a price the customer accepted, not a pointer to a mutable
-- opportunity. Keep the figure on the quote itself so a later stage change can
-- never become the amount invoiced, and record when the customer accepted it so
-- a subscription starts from acceptance rather than from the day the quote was
-- written.
alter table documents add column if not exists amount_cents integer;

alter table documents add column if not exists accepted_at timestamptz;

-- Backfill the figure from the opportunity it was issued for. This is the same
-- value the old invoice path used, so historical quotes keep their meaning.
update documents d
set amount_cents = o.value_cents
from opportunities o
where d.kind = 'quote'
  and d.related_id = o.id
  and d.amount_cents is null;

-- For historical accepted quotes, the customer's own answer is the best record
-- of when acceptance happened. Where no link exists, the quote's creation date
-- is the only honest fallback.
update documents d
set accepted_at = coalesce(
  (
    select min(l.answered_at)
    from quote_links l
    where l.document_id = d.id and l.answered_at is not null
  ),
  d.created_at
)
where d.kind = 'quote'
  and d.status = 'accepted'
  and d.accepted_at is null;

-- A receipt belongs to at most one invoice. The outside guard is not enough when
-- two callers race; the database is the final arbiter.
create unique index if not exists ledger_one_receipt_per_invoice_idx
  on ledger_entries (related_id)
  where kind = 'receipt' and related_id is not null;

create index if not exists documents_accepted_idx
  on documents (related_id, accepted_at desc)
  where kind = 'quote' and status = 'accepted';

-- A notice that the mail server refused must be retried, but not on every tick.
-- The service-notice runner records the attempt here and the planner waits
-- before trying again.
alter table billing_cycles add column if not exists last_notice_attempt_at timestamptz;
