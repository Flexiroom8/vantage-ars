# Managed services

Vantage-ARS sells seven productised services. Each one has a fixed scope, a
published price, and a deliverable the office can produce from its own records.
That last part is the point: a service the office can deliver is a service the
office can bill without a person in the loop, and a service it can bill on a
schedule is recurring revenue rather than a job.

Every plan is remote-only. Prices are in ZAR and come from the published rate
card; VAT is added only where the invoice states it, and the recurring invoice
does not state it. The rate card group these plans sit in is described as:
"Fixed scope, fixed price, produced from our own records. Remote only."

Nothing in this document promises monitoring, uptime or a service level. Those
are the things a customer cannot verify and a business should not sell.

## The seven services

| Service                                                          | Published price | Cycle   | What the customer receives                                                                                                                                 | What is excluded                                                                                                                                       |
| ---------------------------------------------------------------- | --------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Managed support plan (`managed-support`)                         | R2,750 / month  | Monthly | A monthly managed service report, automatic triage of every fault raised, and a quarterly infrastructure review                                            | On-site work, hardware, third-party licences and carrier costs; after-hours work, which is quoted separately; anything outside the published rate card |
| Remote health and spend watch (`health-watch`)                   | R990 / month    | Monthly | A monthly written watch report covering open faults, ageing tickets, response against our own targets, and everything invoiced in the period               | Monitoring of your live estate; on-site work and third-party costs                                                                                     |
| Service report (`service-report`)                                | R690            | One-off | A report covering every fault raised, every quote issued and every invoice raised in the period, in plain language                                         | Any new work — this reports on work already done                                                                                                       |
| Billing and rate compliance audit (`billing-audit`)              | R1,150          | One-off | An audit of the invoices issued in the period, each matched to the published rate line it came from, with anything that does not match called out          | Supplier and carrier invoices, which are not ours to audit                                                                                             |
| Infrastructure documentation and handover pack (`handover-pack`) | R1,380          | One-off | A handover document built from the work the office has recorded: the equipment seen, the faults fixed, the configurations changed, and what is still open  | Site drawings and cabling schedules; anything we have not worked on and cannot see                                                                     |
| Business continuity plan (`continuity-plan`)                     | R1,725          | One-off | A continuity plan built from your recorded fault history: the failure points we have actually seen, the order to recover them in, and the gaps             | A formal disaster recovery or compliance certification; penetration testing                                                                            |
| Service level and response review (`sla-review`)                 | R690            | One-off | A review of the faults raised in the period, how long each took to pick up and resolve, and how that compares with our published internal response targets | A contractual SLA — we publish our targets, we do not sell a guarantee                                                                                 |

Two of the seven are recurring. The office's billing arithmetic supports a
quarterly cycle as well, but no plan is currently published on it.

Each service is priced against its published rate line, and the plan id and the
rate id are the same string: one line, one price. Before the office prices
anything it checks that the plan's published price still matches the rate card,
so an edit to the card can never leave a plan selling at a figure the public
site no longer shows.

## What each report is built from

Every number in a report is read from a row the office already holds. Nothing is
estimated, nothing is extrapolated, and nothing is promised. When the office
has no record of something, the report says so rather than filling the gap. The
period is the billing period the contract says, not a window the office chose.

Every report carries the same footer: it was compiled by the office from its own
records for the period, it describes what the record shows for that period, it
is not a guarantee of future performance, and VAT is added only where the
invoice states it.

The evidence behind each report:

- **Managed support plan** — the faults raised in the period, the faults
  resolved, the faults still open, the severity mix (P1, P2, P3), the quotes
  issued, the invoices issued with their total, the faults grouped by kind, and
  the open items at the end of the period. It also carries a support-hours line
  against the eight included hours. The hours used are not yet counted from the
  record, so that line currently reads zero.
- **Remote health and spend watch** — the open faults, the faults raised and
  resolved in the period, the response of the measured faults against our
  internal targets, the invoices issued with their total, the quotes issued, and
  the open items. It states the internal targets it measures against.
- **Service report** — the faults raised, resolved and still open, the severity
  mix, the quotes issued, the invoices issued with their total, the faults by
  kind, and the open items.
- **Billing and rate compliance audit** — every invoice in the period, listed
  one by one with its reference, its amount, whether it matches a published rate
  line, and which rate line it matches. An invoice matches when its amount is a
  whole number of an offered published figure. The audit reports anything that
  does not reconcile; nothing is adjusted, and the customer is asked to query
  it.
- **Infrastructure documentation and handover pack** — the faults raised,
  resolved and still open, the severity mix, the quotes issued, the invoices
  issued, the faults by kind, and the open items to hand over. It is a record of
  what the office has worked on, not a survey of the site.
- **Business continuity plan** — the failure points recorded for the account,
  with counts, ordered by how often they have been seen, and the gaps visible
  from the open items.
- **Service level and response review** — the faults raised, the severity mix,
  the faults for which a duration could be measured, how many of those fell
  inside the internal target, and the faults by kind.

The response measurement is one elapsed duration per fault: from when the fault
was opened to when the ticket was last updated, on resolved faults, compared
against the target for that severity. The internal targets are P1 four hours,
P2 one working day, and P3 seven days. The office records one duration per
fault, not a separate first-response clock and a separate resolution clock.

The customer never receives an agent's prose. The report body is assembled by
the office from the facts, and the agent asks for the deliverable and the
office produces it.

## The billing model

The two recurring plans run on a schedule the subscription carries. A
subscription's period comes from its own next billing instant, the arithmetic
is done in UTC, and the month arithmetic clamps to the last day of the target
month, so a plan started on the 31st still bills on the 31st where the month is
long enough.

**When a period is invoiced.** The billing duty runs every hour and plans one
work item for each subscription whose next billing date has passed. It creates
the billing period and raises the invoice through the governor, exactly as a
founder-raised invoice would be raised: the delegation caps and the money guards
apply unchanged. The subscription's next billing date then moves to the end of
the period just billed.

**When the deliverable is produced.** The fulfilment duty runs every hour and
plans work for any period that has been invoiced but has no deliverable. The
report is built from the office's own records for that period and filed as a
document, and the period is marked delivered. A period that has been invoiced
and not delivered is a promise the office has made and not kept, so the duty
exists to close that gap.

**When the customer is emailed.** The notice duty runs every hour and plans work
for any delivered period that has not been notified. The message is rendered
from the office's own template, to an address the office already holds for that
customer, and it is written down before it is sent. The send happens after the
transaction commits, so a slow mail server cannot hold the audit lock open. A
notice that could not be sent stays on file as not delivered, with the reason.
The office never claims to have emailed a customer it did not email.

**When a receipt is booked.** The customer files a payment notice. The ledger
duty picks it up every two hours. If the notice carries a reference on an open
invoice and an amount that matches that invoice to the cent, the receipt is
booked, the invoice is marked paid and the period is closed. Anything that does
not match exactly is put in front of the founder, and treasury does not move
until the money is confirmed. A receipt may only retire money that is actually
owed: crediting more than the outstanding receivable is impossible, because the
balance update and the ledger row happen in one transaction that reads the
receivable under lock.

**One invoice per billing period.** A billing period is claimed with a
conditional update inside the invoice transaction, and the period itself is
unique on the subscription and its start date. A retried tick, a restarted
server and two concurrent ticks therefore cannot bill the same month twice. The
same applies to the delivery ticket opened on acceptance, which is inserted only
when one does not already exist for that job.

The five one-off services are ordered once rather than on a schedule. The quote
is priced from the published card and the invoice is raised once against the
won job. The report is assembled from the same records by the same code, but a
one-off opens no billing period, so nothing schedules it and no cycle produces
it.

## The delegations that let it run

None of the above happens on its own. Each step that touches a customer or the
money is a founder gate, and the founder may satisfy those gates once, in
advance, with a standing delegation under ART-13. The office ships with no
delegation at all.

| Preset     | Label                         | Delegated actions                                                                                                                                                 | Customer email | Automatic payment matching | Accepted quote required |
| ---------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------- | ----------------------- |
| `observe`  | Observe only                  | none                                                                                                                                                              | no             | no                         | yes                     |
| `delivery` | Deliver and tell the customer | `fulfil_service`, `send_customer_mail`                                                                                                                            | yes            | no                         | yes                     |
| `billing`  | Bill and collect              | `issue_invoice`, `record_inbound_payment`, `send_customer_mail`                                                                                                   | yes            | yes                        | yes                     |
| `revenue`  | Managed revenue               | `open_opportunity`, `issue_quote`, `issue_invoice`, `record_inbound_payment`, `start_subscription`, `cancel_subscription`, `fulfil_service`, `send_customer_mail` | yes            | yes                        | no                      |

Which preset covers which behaviour:

- **Produce the report and email it to the customer** — Deliver and tell the
  customer, Bill and collect, or Managed revenue.
- **Invoice the period** — Bill and collect or Managed revenue.
- **Match an exact payment notice to the invoice and book the receipt** — Bill
  and collect or Managed revenue, both of which permit automatic payment
  matching.
- **Send the quote to the customer, with the link they accept it on** —
  Managed revenue, which covers both quoting and customer email.
- **Start a subscription from an accepted quote, sell the published plans to a
  real enquiry, or end a subscription** — Managed revenue only.
- **Chase an invoice that has been open for seven days or more** — any preset
  that permits customer email. The dunning duty does nothing without one, and
  after nine weeks the office stops emailing about the invoice.
- **Observe only** — nothing is delegated. Every step that touches a customer or
  the money stops at the founder gate, and the office behaves exactly as it did
  before ART-13.

The caps are the founder's to set. A delegation states the most any single
action may be worth and how many actions it may take per day and per month; the
starting defaults are R5,000.00 for a single action, 20 actions a day and 200 a
month, and the monthly limit may not be set below the daily limit. The
delegation may only charge published rate lines that exist and are offered — a
withheld line never can — and a policy that requires an accepted quote demands
one for every action it covers.

Usage is counted from real rows: each delegated action writes a usage row in the
same transaction that took it, and the caps are a count over those rows. A
founder's own action is not a delegated action and never spends the office's
budget. A delegation can be paused or revoked at any time, and revocation takes
effect on the very next action.

## What this does not do

- **It does not monitor your live estate.** The health watch reads the office's
  own record of your faults, its response times and its invoices. It is not a
  monitoring service, and it cannot tell you that a system is down before
  someone tells the office.
- **It carries no uptime guarantee.** No report states an uptime figure, and
  the office refuses to send an email whose wording promises one.
- **It is not 24/7 cover.** After-hours work is quoted separately from the
  published card, by appointment, and is not an emergency response guarantee.
- **It is not a contractual service level.** The P1 four hour, P2 one working
  day and P3 seven day targets are working targets the office measures itself
  against. The service level review reports performance against them; it does
  not sell them, and the plan excludes a contractual SLA.
- **It does not refund or credit automatically.** A cancellation, a credit and a
  refund are founder decisions. The office raises a service risk for the founder
  and states that nothing was refunded, credited, cancelled or promised.
- **The included support hours are performed by a Vantage-ARS engineer.** The
  office triages, reports, invoices and chases. The eight included remote hours
  are engineering time, delivered by an engineer, not an automated desk.
- **It does not do new work.** The reports describe work already done. Anything
  outside the published rate card is quoted separately.

## Onboarding

1. The customer contacts the office and the enquiry is recorded. The office may
   only put a commercial offer in front of a customer who actually contacted
   us, so this record is the anchor for everything that follows.
2. A quote is prepared for the plan, priced from the published rate card.
3. The quote goes to the customer as a link, valid for thirty days.
4. The customer accepts by name on the link. That closes the opportunity as won,
   marks the quote accepted and opens the delivery ticket.
5. For a recurring plan, the office starts the subscription. The first period is
   the one the customer bought; the subscription recurs from the day that period
   ends.
6. Each period is then invoiced, delivered, emailed and paid, in that order.

## Leaving

Ending a subscription is a founder decision. The founder ends it from the
office, with a reason; the subscription is marked cancelled, and any billing
period that has not yet started is cancelled with it. No duty plans a
cancellation on its own initiative, and the office does not end a subscription
because a customer stopped replying.

An invoice that has already been issued is not reversed by a cancellation: it
stays on the books. A refund or a credit is a separate founder decision, and
the office never issues one on its own.
