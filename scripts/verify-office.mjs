/**
 * End-to-end proof that the office runs itself.
 *
 * This is NOT a mock and NOT sample data: it boots the real application
 * modules against a real embedded Postgres (PGLite), creates only records the
 * public site would really create (a form enquiry, a support request, a chat
 * message), then runs the real scheduler tick and asserts on what the real
 * agents actually did.
 *
 * It is the check that "the office works autonomously" is a fact rather than a
 * claim. Run with:
 *
 *   npm run verify:office
 */
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A real on-disk Postgres so nothing is held in memory between steps.
const dataDir = mkdtempSync(join(tmpdir(), "vantage-office-verify-"));
process.env.PGLITE_DATA_DIR = dataDir;
delete process.env.DATABASE_URL;
process.env.AUTONOMY = "on";
process.env.FOUNDER_EMAIL = "founder@vantage-ars.co.za";

const checks = [];
let failures = 0;

/**
 * A deterministic clock.
 *
 * Duties keep their own cadence, so the first tick marks them all "just ran"
 * and the second tick correctly finds nothing due. To exercise the office the
 * way a real day does, the harness advances its own reference time instead of
 * sleeping. The records are real; only the clock moves.
 */
const T0 = Date.now();
let minutes = 0;
const at = () => new Date(T0 + minutes * 60_000).toISOString();
/** Advance the clock past every duty cadence, then run the office. */
let advanceAndTick = async (byMinutes) => {
  minutes += byMinutes;
  throw new Error("scheduler not wired");
};

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  checks.push({ name, ok, detail });
  process.stdout.write(`${ok ? "  ok  " : " FAIL "} ${name}${detail && !ok ? ` — ${detail}` : ""}\n`);
}

async function main() {
  const { getSql } = await import("../src/lib/db.ts");
  const { ensureOffice, applyProposedAction, readSnapshot, logInboundItem, resolveApproval } = await import(
    "../src/lib/office/store.server.ts"
  );
  const { tick, schedulerStatus } = await import("../src/lib/office/scheduler.server.ts");
  advanceAndTick = async (byMinutes) => {
    minutes += byMinutes;
    return tick({ now: at() });
  };
  const { listWork, workCounts } = await import("../src/lib/office/work-queue.server.ts");
  const { officeHealth } = await import("../src/lib/office/health.server.ts");
  const { verifyChainLinks } = await import("../src/lib/office/integrity.ts");
  const { processWebsiteEnquiry } = await import("../src/lib/office/intake.ts");

  const sql = await getSql();

  // ── 1. Provision ────────────────────────────────────────────────────────────
  await ensureOffice();
  const company = await sql`select * from company_state where id = 'vantage-ars'`;
  check("office provisions itself", company.length === 1);
  const agents = await sql`select id, callsign from agents order by callsign`;
  check("nine identities are issued", agents.length === 9, `got ${agents.length}`);

  const firstTick = await tick({ now: at() });
  check("first tick is healthy", firstTick.ok, firstTick.detail);

  // ── 2. Real inbound, exactly as the public form produces it ─────────────────
  const buyingInbound = await logInboundItem({
    channel: "web",
    companyName: "Harbour Point Dental",
    subject: "Replacing a 4-year-old PBX for 18 staff",
    summary: [
      "Email: admin@harbourpoint.example",
      "Source: vantage-ars.co.za enquiry form. No automated reply sent.",
      "",
      "We are a dental practice with 18 staff on an ageing hosted PBX that a provider is retiring.",
      "We would like a quote to migrate to something supported, including handset replacements.",
      "Could you quote for 18 extensions, a migration plan, and what the handsets would cost?",
    ].join("\n"),
    intent: "enquiry",
  });

  const faultInbound = await logInboundItem({
    channel: "web",
    companyName: "Kleinbos Logistics",
    subject: "No dial tone at the main switch since 06:00",
    summary: [
      "Email: ops@kleinbos.example",
      "Source: vantage-ars.co.za customer service desk. No automated reply sent.",
      "Matter: fault",
      "",
      "No dial tone on the main switch since 06:00 and the outbound trunk is down.",
      "This is stopping us from taking orders.",
    ].join("\n"),
    intent: "support",
  });

  check("enquiry and fault are both on file", Boolean(buyingInbound && faultInbound));

  // ── 2b. The exact path the public enquiry form takes ──────────────────────
  // `submitPublicEnquiry` records the inbound item and then calls
  // `processWebsiteEnquiry`. Running the real one proves the public form is
  // wired to the office, not just to a database row.
  const formInbound = await logInboundItem({
    channel: "web",
    companyName: "Beacon Hill Dental",
    subject: "PBX provider retiring in 60 days",
    summary: "Email: admin@beaconhill.example\nWe have 14 staff and need a quote to migrate off a retiring PBX.",
    intent: "enquiry",
  });
  const routed = await processWebsiteEnquiry({
    inboundId: formInbound,
    name: "Beacon Hill Dental",
    message:
      "Our hosted PBX provider is retiring in 60 days. We have 14 staff and need a quote to migrate to a supported system, including handsets.",
  });
  check("the public enquiry form reached the office", typeof routed.handoff === "boolean");
  const formRouted = await sql`select status, routed_to from inbound_items where id = ${formInbound}`;
  check("the form enquiry was routed by reception", formRouted[0]?.status === "routed", JSON.stringify(formRouted));

  // ── 3. Run the office. Nothing here is briefed by hand. ────────────────────
  // Enough time for reception's cadence. Marketing's own cadences are longer,
  // and the lead does not exist yet, so it needs its own window below.
  const tick2 = await advanceAndTick(200);
  check("reception classified both items without instruction", tick2.ran.length >= 2, tick2.detail);

  const leads = await sql`select company_name, stage from leads order by company_name`;
  const tickets = await sql`select title, owner_agent, status from tickets`;
  check(
    "the buying enquiry became a real lead",
    leads.some((lead) => lead.company_name === "Harbour Point Dental"),
    JSON.stringify(leads),
  );
  check(
    "the fault became a real service ticket owned by DESK",
    tickets.some((ticket) => ticket.owner_agent === "desk"),
    JSON.stringify(tickets),
  );

  // ── 4. Marketing scores and escalates the real demand ──────────────────────
  // The lead only exists after the previous tick, so marketing needs its own
  // window to see it. Two hours covers the qualifying cadence (180 min).
  const tickMarketing = await advanceAndTick(200);
  check("marketing ran on its own cadence", tickMarketing.ok, tickMarketing.detail);
  const stages = leads.map((lead) => `${lead.company_name}:${lead.stage}`);
  const scored = await sql`select company_name, stage, score from leads`;
  check(
    "the lead was qualified or scored, not left untouched",
    scored.some((lead) => /qualified|nurture|ready_for_sales|in_sales/.test(String(lead.stage))),
    scored.map((lead) => `${lead.company_name}:${lead.stage}(${lead.score})`).join(" | "),
  );
  check(
    "the fault enquiry did not become a sales lead",
    !scored.some((lead) => lead.company_name === "Kleinbos Logistics" && /sales/.test(String(lead.stage))),
    scored.map((lead) => `${lead.company_name}:${lead.stage}`).join(" | "),
  );
  void stages;

  const handoffs = await sql`select id, company_name, status from approvals where kind = 'sales_handoff'`;
  check(
    "buying intent stopped at the founder gate, not past it",
    handoffs.length >= 1 && handoffs.every((row) => row.status === "pending"),
    JSON.stringify(handoffs),
  );
  check(
    "the founder gate names the real company",
    handoffs.some((row) => row.company_name === "Harbour Point Dental"),
    JSON.stringify(handoffs),
  );

  // Marketing must not have created an opportunity itself.
  const earlyOpps = await sql`select company_name, stage from opportunities`;
  check(
    "marketing did not open a sale without the founder",
    earlyOpps.length === 0,
    JSON.stringify(earlyOpps),
  );

  // ── 5. Founder approves the handoff. Sales may now work. ──────────────────
  let approved = null;
  const approvalResults = [];
  for (const row of handoffs) {
    const result = await resolveApproval({ approvalId: row.id, decision: "approved", note: "Real demand. Handle it." });
    approvalResults.push(`${row.company_name}: ${JSON.stringify(result)}`);
    if (result.ok) approved = row;
  }
  check("founder approval executed the handoff", Boolean(approved), approvalResults.join(" | "));

  // Both real enquiries produced their own pipeline, so assert per company
  // rather than on a total.
  const opps = await sql`select id, company_name, stage, lead_id from opportunities where company_name = 'Harbour Point Dental'`;
  check("an opportunity exists for the approved company", opps.length === 1, JSON.stringify(opps));
  const opp = opps[0];
  check("the opportunity points at a real lead", Boolean(opp?.lead_id));
  const allOpps = await sql`select company_name from opportunities`;
  check(
    "every opportunity has its own company",
    new Set(allOpps.map((row) => row.company_name)).size === allOpps.length,
    JSON.stringify(allOpps),
  );

  // ── 6. Sales does discovery on its own ─────────────────────────────────────
  // Long enough that sales' 240-minute discovery cadence comes round again
  // after the opportunity actually existed.
  const tick3 = await advanceAndTick(300);
  check("the tick that reached sales was clean", tick3.ok, tick3.detail);
  const internalDocs = await sql`select title, kind, status from documents where kind = 'internal'`;
  check(
    "sales wrote a real discovery document without being told to",
    internalDocs.some((doc) => /Discovery/.test(doc.title)),
    JSON.stringify(internalDocs.map((doc) => doc.title)),
  );
  check(
    "the discovery document is a draft, not a customer commitment",
    internalDocs.filter((doc) => /Discovery/.test(doc.title)).every((doc) => doc.status === "draft"),
    JSON.stringify(internalDocs),
  );

  // ── 7. Sales issues a quote at the published rate, founder-gated ───────────
  const quote = await applyProposedAction(
    "close",
    {
      kind: "issue_quote",
      title: "Quote · Harbour Point Dental",
      rationale: "On-site PBX migration labour, priced from the published rate card.",
      confidence: 0.95,
      amountCents: 80500 * 8,
      companyName: "Harbour Point Dental",
      relatedId: opp.id,
      payload: { rateId: "pbx-install", location: "onsite", quantity: 8 },
    },
    { source: "verify" },
  );
  check("a quote always stops at the founder gate", quote.status === "escalated", quote.status);
  check("the founder was asked, not bypassed", Boolean(quote.approvalId));

  const quoteDocs = await sql`select summary, status from documents where kind = 'quote'`;
  check("no customer-facing quote exists yet", quoteDocs.length === 0, JSON.stringify(quoteDocs));

  await resolveApproval({ approvalId: quote.approvalId, decision: "approved", note: "Correct rate." });
  const afterQuote = await sql`select summary, status from documents where kind = 'quote'`;
  check("approval produced exactly one quote document", afterQuote.length === 1, JSON.stringify(afterQuote));
  // formatZar renders "R 6 440,00"; assert on the computed figure so the check
  // tracks the rate card rather than a formatting detail.
  const { formatZar } = await import("../src/lib/office/money.ts");
  const expectedTotal = formatZar(80500 * 8);
  check(
    "the quote text carries the published total, not an invented one",
    afterQuote[0]?.summary.includes(expectedTotal),
    `expected ${expectedTotal} in: ${afterQuote[0]?.summary ?? ""}`,
  );
  check(
    "the quote names the published rate line it came from",
    afterQuote[0]?.summary.includes("VoIP / PBX installation, on-site"),
    afterQuote[0]?.summary ?? "",
  );
  check(
    "the quote states its internal status",
    afterQuote[0]?.summary.includes("INTERNAL QUOTE DRAFT"),
    afterQuote[0]?.summary ?? "",
  );

  // ── 8. Money is safe ───────────────────────────────────────────────────────
  const ledger = await sql`select kind, amount_cents, status from ledger_entries`;
  check("nothing was billed without a won deal", ledger.length === 0, JSON.stringify(ledger));
  const money = await sql`select treasury_cents, receivable_cents from company_state`;
  check("treasury and receivable are still zero", Number(money[0].treasury_cents) === 0 && Number(money[0].receivable_cents) === 0);

  // A receipt with nothing owed must not create money.
  const bogus = await applyProposedAction(
    "ledger",
    {
      kind: "record_inbound_payment",
      title: "Receipt with no invoice",
      rationale: "Should be refused: nothing is owed.",
      confidence: 0.99,
      amountCents: 500000,
      companyName: "Nobody",
      payload: {},
    },
    { source: "verify" },
  );
  check("a receipt against nothing is refused", bogus.status !== "executed", bogus.status ?? "");
  const moneyAfter = await sql`select treasury_cents from company_state`;
  check("a refused receipt did not create money", Number(moneyAfter[0].treasury_cents) === 0);

  // ── 9. The customer accepts on their link, and only once ───────────────────
  const { createQuoteLink, answerPublicQuote } = await import("../src/lib/office/store.server.ts");
  const quoteDoc = await sql`select id from documents where kind = 'quote' limit 1`;
  const link = await createQuoteLink(quoteDoc[0].id);
  check("a customer link can be issued for a waiting quote", link.ok);

  const answer = await answerPublicQuote(link.token, {
    outcome: "accepted",
    name: "Dr A. Meyer",
    note: "Please proceed.",
  });
  check("the customer's acceptance closed the deal", answer.ok, JSON.stringify(answer));

  const second = await answerPublicQuote(link.token, { outcome: "accepted", name: "Dr A. Meyer", note: "" });
  check("a second acceptance is refused", second.ok === false, JSON.stringify(second));

  const closed = await sql`select stage, value_cents from opportunities where id = ${opp.id}`;
  check("the opportunity is won", closed[0]?.stage === "won");
  check("the won value is the published figure", Number(closed[0]?.value_cents) === 644000, String(closed[0]?.value_cents));

  const delivery = await sql`select owner_agent, related_id from tickets where related_id = ${opp.id}`;
  check("delivery opened exactly one ticket", delivery.length === 1, JSON.stringify(delivery));

  // ── 10. Ledger books the invoice, then the receipt, once ───────────────────
  const { raiseQuoteInvoice, recordInvoiceReceipt } = await import("../src/lib/office/store.server.ts");
  const invoices = await sql`select id, amount_cents from ledger_entries where kind = 'invoice'`;
  check("no invoice before the founder raises it", invoices.length === 0);

  await advanceAndTick(200);
  const nudge = await sql`select kind from work_items where kind = 'nudge_invoice'`;
  check("sales noticed the un-invoiced win by itself", nudge.length >= 1);

  const raised = await raiseQuoteInvoice(opp.id, "none");
  check("the invoice raises cleanly", raised.ok, JSON.stringify(raised));
  const twice = await raiseQuoteInvoice(opp.id, "none");
  check("a second invoice for the same job is refused", twice.ok === false, JSON.stringify(twice));

  const afterInvoice = await sql`select treasury_cents, receivable_cents from company_state`;
  check("the invoice raised the receivable", Number(afterInvoice[0].receivable_cents) === 644000, String(afterInvoice[0].receivable_cents));
  check("the invoice did not touch treasury", Number(afterInvoice[0].treasury_cents) === 0);

  await recordInvoiceReceipt(invoices.length ? "" : (await sql`select id from ledger_entries where kind = 'invoice' limit 1`)[0].id);
  const afterReceipt = await sql`select treasury_cents, receivable_cents from company_state`;
  check("the receipt moved money into treasury", Number(afterReceipt[0].treasury_cents) === 644000, String(afterReceipt[0].treasury_cents));
  check("the receivable cleared", Number(afterReceipt[0].receivable_cents) === 0, String(afterReceipt[0].receivable_cents));

  // ── 11. Service desk and technical work ────────────────────────────────────
  await advanceAndTick(60);
  const ackDocuments = await sql`select kind, status from documents where kind = 'service_ack'`;
  check(
    "the service desk acknowledged the fault on its own",
    ackDocuments.length >= 1,
    "no acknowledgement was ever drafted",
  );
  check(
    "the acknowledgement is a draft, not an email",
    ackDocuments.every((row) => row.status === "draft"),
    JSON.stringify(ackDocuments),
  );

  const procedures = await sql`select summary from tickets where owner_agent = 'desk' or owner_agent = 'forge'`;
  check(
    "technical wrote a real procedure",
    procedures.some((row) => /FORGE:/.test(row.summary)),
    JSON.stringify(procedures.map((row) => row.summary.slice(0, 60))),
  );

  // ── 12. Nobody emailed a customer ──────────────────────────────────────────
  const sent = await sql`select status, detail from founder_notices`;
  check(
    "founder notices record that mail was unavailable rather than pretending",
    sent.every((row) => row.status !== "sent" || /SMTP/.test(row.detail)),
    JSON.stringify(sent.map((row) => row.status)),
  );

  // ── 13. The chain verifies and the office agrees ───────────────────────────
  const chain = await sql`
    select id, previous_hash, record_hash, created_at from (
      select id, previous_hash, record_hash, created_at from audit_events
      union all
      select id, previous_hash, record_hash, created_at from decisions
    ) c order by created_at asc
  `;
  const head = await sql`select last_audit_hash from company_state`;
  const verdict = verifyChainLinks(
    chain.map((row) => ({
      id: String(row.id),
      previousHash: String(row.previous_hash),
      recordHash: String(row.record_hash),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    String(head[0].last_audit_hash),
  );
  check("the audit chain verifies end to end", verdict.ok, verdict.detail);
  check("the chain is substantial", verdict.checked > 20, `only ${verdict.checked} records`);

  // ── 14. Repeat ticks are idempotent, not amplifying ────────────────────────
  const countsBefore = await workCounts();
  const queueBefore = (await listWork(200)).length;
  await advanceAndTick(10);
  await advanceAndTick(10);
  const queueAfter = (await listWork(200)).length;
  check(
    "repeat ticks do not pile up duplicate work",
    queueAfter - queueBefore <= 1,
    `queue went ${queueBefore} → ${queueAfter} (open was ${countsBefore.open})`,
  );

  const invoices2 = await sql`select id from ledger_entries where kind = 'invoice'`;
  check("repeat ticks never book a second invoice", invoices2.length === 1, String(invoices2.length));
  const dupQuotes = await sql`select id from documents where kind = 'quote'`;
  check("repeat ticks never duplicate a quote", dupQuotes.length === 1, String(dupQuotes.length));

  // ── 15. Halt is honoured everywhere ────────────────────────────────────────
  const { setOfficeHalt } = await import("../src/lib/office/store.server.ts");
  await setOfficeHalt(true, "Verification halt.");
  const haltedTick = await advanceAndTick(10);
  check("a halted office runs nothing", haltedTick.skipped === "halted" && haltedTick.ran.length === 0);
  const blockedApproval = await resolveApproval({
    approvalId: (await sql`select id from approvals where status = 'pending' limit 1`)[0]?.id ?? "none",
    decision: "approved",
  });
  check("a halted office refuses queued approvals", blockedApproval.ok === false);
  await setOfficeHalt(false, "Verification resume.");

  // ── 16. Health agrees with reality ─────────────────────────────────────────
  const health = await officeHealth({ full: true });
  check("health reports the database up", health.database.ok, health.database.detail);
  check("health reports the chain intact", health.chain.ok, health.chain.detail);
  check("health reports autonomy enabled", health.scheduler.autonomyEnabled);
  check("health counts the duties", health.scheduler.duties >= 20, String(health.scheduler.duties));
  check("health reports the real balance", health.money.treasuryCents === 644000, String(health.money.treasuryCents));
  check("health found nothing structurally wrong", health.problems.every((p) => p.startsWith("Founder notices")), JSON.stringify(health.problems));

  // ── 17. The floor read path still works ────────────────────────────────────
  const snapshot = await readSnapshot();
  check("the office snapshot reads", snapshot.company.tradingName === "Vantage-ARS");
  check("the snapshot carries the real figures", snapshot.company.treasuryCents === 644000, String(snapshot.company.treasuryCents));
  check("the snapshot carries the decision trail", snapshot.decisions.length > 10, String(snapshot.decisions.length));
  check("health metrics are real, not constants", snapshot.health.constraintAdherence <= 1 && snapshot.health.decisionCount > 0);

  const status = await schedulerStatus();
  check("the scheduler reports its duties", status.dueDuties.length >= 20);
  check("the scheduler recorded runs", status.recentRuns.length > 5, String(status.recentRuns.length));

  // ── 18. Marketing finds demand in the site's own traffic ───────────────────
  // Real visitor records, exactly what the public site writes. Two visits to a
  // buying page, one to the quote page, and several to a page that is not a
  // buying signal.
  const { recordSiteEvent } = await import("../src/lib/office/office-view.server.ts");
  await recordSiteEvent({ kind: "page_view", path: "/rates" });
  await recordSiteEvent({ kind: "page_view", path: "/rates" });
  await recordSiteEvent({ kind: "page_view", path: "/quote" });
  await recordSiteEvent({ kind: "page_view", path: "/" });
  await recordSiteEvent({ kind: "page_view", path: "/" });

  await advanceAndTick(1500); // past the daily prospect cadence — 2490
  await advanceAndTick(200); // qualification's own cadence — 2690

  const prospectLeads = await sql`
    select id, company_name, stage, score, summary from leads where company_name like 'Prospect %'
  `;
  check(
    "repeat visits to a buying page became a prospect lead",
    prospectLeads.some((lead) => lead.company_name === "Prospect · /rates"),
    JSON.stringify(prospectLeads.map((lead) => lead.company_name)),
  );
  check(
    "the prospect carries the site's own evidence and no invented contact",
    prospectLeads.length > 0 && prospectLeads.every((lead) => /recorded visit/.test(String(lead.summary)) && !String(lead.summary).includes("@")),
    JSON.stringify(prospectLeads.map((lead) => lead.summary)),
  );
  check(
    "a page that is not a buying signal was ignored",
    !prospectLeads.some((lead) => lead.company_name === "Prospect · /"),
    JSON.stringify(prospectLeads.map((lead) => lead.company_name)),
  );
  check(
    "the prospect was qualified out of engaged without being sold",
    prospectLeads.length > 0 && prospectLeads.every((lead) => lead.stage === "nurture" && Number(lead.score) < 45),
    JSON.stringify(prospectLeads.map((lead) => `${lead.company_name}:${lead.stage}(${lead.score})`)),
  );
  check(
    "qualification scored the prospect without erasing what the site recorded",
    prospectLeads.every((lead) => /recorded visit/.test(String(lead.summary))),
    JSON.stringify(prospectLeads.map((lead) => String(lead.summary).slice(0, 60))),
  );
  const prospectHandoffs = await sql`
    select id from approvals where kind = 'sales_handoff' and company_name like 'Prospect %'
  `;
  check("anonymous interest never reached the founder as a sale", prospectHandoffs.length === 0, JSON.stringify(prospectHandoffs));

  // Qualification must stay a one-time transition. It is due every three
  // hours; if it re-scored decided leads the chain would grow duplicates
  // forever while the office looked busy.
  const updateLeadDecisions = async () =>
    Number((await sql`select count(*)::int as n from decisions where action_kind = 'update_lead'`)[0].n);
  const updatesBefore = await updateLeadDecisions();
  await advanceAndTick(1440);
  await advanceAndTick(1440);
  const updatesAfter = await updateLeadDecisions();
  check(
    "qualification runs once per lead, not every three hours",
    updatesAfter === updatesBefore,
    `update_lead decisions went ${updatesBefore} → ${updatesAfter}`,
  );

  // ── 19. The weekly campaign drafts itself, at R0, owned-channel ────────────
  await advanceAndTick(5000); // past the weekly campaign cadence — 10570
  const campaigns = await sql`select name, channel, status, budget_cents, summary from campaigns`;
  const weeklyDrafts = campaigns.filter((c) => /Owned-channel campaign/.test(String(c.name)));
  check("the weekly campaign drafted itself from nurtured demand", weeklyDrafts.length >= 1, JSON.stringify(campaigns.map((c) => c.name)));
  check(
    "the campaign is an owned-channel draft at R0",
    weeklyDrafts.every((c) => c.channel === "owned" && c.status === "draft" && Number(c.budget_cents) === 0),
    JSON.stringify(weeklyDrafts),
  );
  check(
    "the campaign names the real nurtured leads it is for",
    weeklyDrafts.some((c) => String(c.summary).includes("Prospect · /rates")),
    JSON.stringify(weeklyDrafts.map((c) => String(c.summary).slice(0, 80))),
  );

  // ── 20. The orchestrator briefs the founder with real figures ──────────────
  const briefings = await sql`
    select subject, status, detail from founder_notices where subject like '%daily briefing%'
  `;
  check("the orchestrator briefed the founder daily", briefings.length >= 1, JSON.stringify(briefings.map((b) => b.subject)));
  const briefingDecisions = await sql`
    select rationale from decisions where action_kind = 'notify_operator' and title like 'Daily briefing%'
  `;
  check(
    "the briefing reports the real treasury, not a constant",
    briefingDecisions.some((row) => String(row.rationale).includes(`treasury ${formatZar(644000)}`)),
    JSON.stringify(briefingDecisions.map((row) => String(row.rationale).slice(0, 80))),
  );
  check(
    "the briefing carries the queue and the last day's activity",
    briefingDecisions.some((row) => /Queue now:/.test(String(row.rationale)) && /Last 24 hours:/.test(String(row.rationale))),
    JSON.stringify(briefingDecisions.map((row) => String(row.rationale).slice(0, 80))),
  );
  check(
    "the briefing never claims a customer was emailed",
    briefings.every((row) => row.status !== "sent" || /SMTP/.test(String(row.detail))),
    JSON.stringify(briefings.map((row) => row.status)),
  );

  // ── 21. A week of autonomous marketing kept the chain intact ───────────────
  const chain2 = await sql`
    select id, previous_hash, record_hash, created_at from (
      select id, previous_hash, record_hash, created_at from audit_events
      union all
      select id, previous_hash, record_hash, created_at from decisions
    ) c order by created_at asc
  `;
  const head2 = await sql`select last_audit_hash from company_state`;
  const verdict2 = verifyChainLinks(
    chain2.map((row) => ({
      id: String(row.id),
      previousHash: String(row.previous_hash),
      recordHash: String(row.record_hash),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    String(head2[0].last_audit_hash),
  );
  check("the chain still verifies after a week of autonomous marketing", verdict2.ok, verdict2.detail);
  check(
    "the week added real decisions to the chain",
    verdict2.checked > verdict.checked,
    `${verdict.checked} → ${verdict2.checked}`,
  );
  // The view reads the chain and the stored head in one statement, so a busy
  // office can never see its own in-flight append as a broken chain — the
  // false positive that would halt the office through SEAL.
  const { readDutyView } = await import("../src/lib/office/office-view.server.ts");
  const busyView = await readDutyView(at());
  check(
    "a busy office still trusts its chain after the tick that wrote it",
    busyView.chainIntact === true,
    "the view reported the chain as broken moments after its own tick appended to it",
  );

  // ── 22. A public surface may nudge a stale scheduler ───────────────────────
  const { kickFloorIfStale } = await import("../src/lib/office/kick.server.ts");
  const freshNudge = await kickFloorIfStale();
  check(
    "a fresh scheduler declines an opportunistic nudge",
    freshNudge.kicked === false && freshNudge.reason === "fresh",
    JSON.stringify(freshNudge),
  );
  await sql`update office_state set last_tick_at = now() - interval '30 minutes'`;
  const staleNudge = await kickFloorIfStale();
  check(
    "a stale scheduler is nudged back on cadence by a public surface",
    staleNudge.kicked === true && /Duties due and planned/.test(String(staleNudge.detail)),
    JSON.stringify(staleNudge).slice(0, 200),
  );
  const afterNudge = await sql`select last_tick_at from office_state`;
  check(
    "the nudge recorded the catch-up tick",
    Date.now() - Date.parse(new Date(afterNudge[0].last_tick_at).toISOString()) < 60_000,
    String(afterNudge[0].last_tick_at),
  );

  // ── Result ─────────────────────────────────────────────────────────────────
  const passed = checks.length - failures;
  process.stdout.write(`\n${passed}/${checks.length} checks passed.\n`);
  if (failures) {
    process.stdout.write(`\nFAILED:\n${checks.filter((c) => !c.ok).map((c) => ` - ${c.name}`).join("\n")}\n`);
  }
  void randomUUID;
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  process.stderr.write(`\nVerification crashed: ${error?.stack ?? error}\n`);
  process.exit(1);
}).finally(() => {
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {
    // Best effort cleanup of the temporary database.
  }
});