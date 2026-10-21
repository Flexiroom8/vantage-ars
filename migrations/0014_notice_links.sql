-- Link a customer notice to the thing it is about. A quote notice already has
-- document_id, but an invoice or receipt notice needs the ledger entry id so
-- the office can prove it has not sent the same paperwork twice.
alter table customer_notices add column if not exists related_id text;

create index if not exists customer_notices_related_idx
  on customer_notices (template, related_id);

-- A job can only be invoiced once. Recurring cycles already have a conditional
-- claim; this is the same guard for one-off work.
create unique index if not exists ledger_one_invoice_per_subject_idx
  on ledger_entries (related_id)
  where kind = 'invoice' and related_id is not null;
