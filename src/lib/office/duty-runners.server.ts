/**
 * Duty runners — the execution half of autonomy.
 *
 * A runner receives one real work item and does the real thing it describes,
 * through the same governor every agent action goes through. A runner may NOT:
 *   - send email to a customer,
 *   - spend money,
 *   - win or lose a customer,
 *   - publish anything the founder has not approved.
 *
 * It may write drafts, open tickets, advance records the founder has already
 * authorised, and raise approvals. That boundary is what makes "runs by itself"
 * safe rather than reckless.
 */
import { randomUUID } from "node:crypto";
import { getSql } from "../db";
import { applyProposedAction, setOfficeHalt } from "./store.server";
import { sendCustomerMail } from "./smtp.server";
import { heartbeat } from "./office-view.server";
import { formatZar } from "./money";
import { PRICE_GUIDE, rateCardIntegrity } from "./duties";
import { COMPANY } from "./company";
import type { WorkItem } from "./work-queue.server";
import type { DutyView, PlannedWork } from "./duties";
import { scoreLead } from "./duties";

export type DutyResult = {
  outcome: string;
  /** Actions actually executed through the governor. */
  executed: number;
  escalated: number;
  blocked: number;
};

type Runner = (item: WorkItem, view: DutyView) => Promise<DutyResult>;

function noop(outcome: string): DutyResult {
  return { outcome, executed: 0, escalated: 0, blocked: 0 };
}

async function fileDocument(input: {
  title: string;
  kind: string;
  status?: string;
  summary: string;
  relatedId?: string | null;
}): Promise<string> {
  const sql = await getSql();
  const id = randomUUID();
  await sql`
    insert into documents (id, title, kind, status, summary, related_id)
    values (${id}, ${input.title}, ${input.kind}, ${input.status ?? "draft"}, ${input.summary}, ${input.relatedId ?? null})
  `;
  return id;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function intOf(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// ── VANTAGE ───────────────────────────────────────────────────────────────────

const reportSilentAgent: Runner = async (item) => {
  const result = await applyProposedAction(
    "vantage",
    {
      kind: "notify_operator",
      title: `${str(item.payload.silentAgent).toUpperCase()} has gone quiet`,
      rationale: item.reason,
      confidence: 0.9,
      amountCents: 0,
      payload: {},
    },
    { source: "scheduler", workItem: item.id },
  );
  return {
    outcome: `${result.status}: ${item.reason}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

const reportStuckBacklog: Runner = async (item) => {
  const stuck = Array.isArray(item.payload.stuck) ? (item.payload.stuck as { agentId: string; kind: string }[]) : [];
  const result = await applyProposedAction(
    "vantage",
    {
      kind: "notify_operator",
      title: `Work backlog is stuck (${stuck.length} items)`,
      rationale: item.reason,
      confidence: 0.95,
      amountCents: 0,
      payload: {},
    },
    { source: "scheduler", workItem: item.id },
  );
  return {
    outcome: `Stuck backlog reported: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

const reportAbandonedWork: Runner = async (item) => {
  const result = await applyProposedAction(
    "vantage",
    {
      kind: "notify_operator",
      title: "Work items exhausted their retries",
      rationale: item.reason,
      confidence: 0.95,
      amountCents: 0,
      payload: {},
    },
    { source: "scheduler", workItem: item.id },
  );
  return {
    outcome: `Abandoned work reported: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

// ── FOYER ─────────────────────────────────────────────────────────────────────

const routeInbound: Runner = async (item) => {
  const inboundId = str(item.payload.inboundId);
  const result = await applyProposedAction(
    "foyer",
    {
      kind: "route_inbound",
      title: `Route ${str(item.payload.intent) || "enquiry"} from ${str(item.payload.companyName)}`,
      rationale: item.reason,
      confidence: 0.92,
      amountCents: 0,
      companyName: str(item.payload.companyName),
      relatedId: inboundId,
      payload: { routedTo: str(item.payload.intent) === "support" ? "desk" : "signal" },
    },
    { source: "scheduler", workItem: item.id },
  );
  return {
    outcome: `Routed ${inboundId}: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

/**
 * Classify a real enquiry and file it as a lead or a support ticket.
 *
 * The classification is deterministic and explainable — it reads what the person
 * actually wrote. Nothing is guessed about a company that is not on the record.
 */
const classifyInbound: Runner = async (item) => {
  const inboundId = str(item.payload.inboundId);
  const companyName = str(item.payload.companyName) || "Unnamed enquiry";
  const summary = str(item.payload.summary);
  const declared = str(item.payload.intent);

  // The buyer's own words, minus our own routing header. This is what the lead
  // and the ticket are built from, and what every later duty scores.
  const customerWords = summary
    .replace(/^Email:.*$/im, "")
    .replace(/^Source:.*$/im, "")
    .replace(/^Matter:.*$/im, "")
    .trim()
    .slice(0, 3000);

  if (declared === "payment_notice") {
    const result = await applyProposedAction(
      "foyer",
      {
        kind: "route_inbound",
        title: `Payment notice from ${companyName}`,
        rationale: "Customer says they paid. Ledger holds the notice; no receipt is booked.",
        confidence: 0.95,
        amountCents: 0,
        companyName,
        relatedId: inboundId,
        payload: { routedTo: "ledger" },
      },
      { source: "scheduler", workItem: item.id },
    );
    return {
      outcome: `Payment notice routed to ledger: ${result.status}`,
      executed: result.status === "executed" ? 1 : 0,
      escalated: result.status === "escalated" ? 1 : 0,
      blocked: result.status === "blocked" ? 1 : 0,
    };
  }

  const looksLikeSupport =
    declared === "support" ||
    /\b(fault|broken|not working|down|outage|no dial|no internet|dropping|intermittent)\b/i.test(summary);

  const result = looksLikeSupport
    ? await applyProposedAction(
        "foyer",
        {
          kind: "open_ticket",
          title: `Service request · ${companyName}`,
          rationale: customerWords || item.reason,
          confidence: 0.85,
          amountCents: 0,
          companyName,
          relatedId: inboundId,
          payload: { owner: "desk", severity: "p2" },
        },
        { source: "scheduler", workItem: item.id },
      )
    : await applyProposedAction(
        "foyer",
        {
          kind: "create_lead",
          title: `Enquiry · ${companyName}`,
          rationale: customerWords || item.reason,
          confidence: 0.8,
          amountCents: 0,
          companyName,
          relatedId: inboundId,
          payload: {
            source: `site:${str(item.payload.channel)}`,
            stage: "engaged",
            score: 50,
            evidence: customerWords,
          },
        },
        { source: "scheduler", workItem: item.id },
      );

  return {
    outcome: `${looksLikeSupport ? "Opened a service ticket" : "Filed a lead"} for ${companyName}: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

const escalateStaleEnquiry: Runner = async (item) => {
  const result = await applyProposedAction(
    "foyer",
    {
      kind: "notify_operator",
      title: `Enquiry from ${str(item.payload.companyName)} is ${str(item.payload.ageHours)}h old`,
      rationale: item.reason,
      confidence: 0.95,
      amountCents: 0,
      companyName: str(item.payload.companyName),
      relatedId: str(item.payload.inboundId),
      payload: {},
    },
    { source: "scheduler", workItem: item.id },
  );
  return {
    outcome: `Founder notified about a stale enquiry: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

// ── SIGNAL (marketing) ────────────────────────────────────────────────────────

const analyseSiteSignals: Runner = async (item, view) => {
  const byPath = new Map<string, number>();
  for (const event of view.siteEvents) byPath.set(event.path, (byPath.get(event.path) ?? 0) + 1);
  const ranked = [...byPath.entries()].sort((a, b) => b[1] - a[1]);
  const total = view.siteEvents.length;
  const inboundCount = view.inbound.length;
  const conversion = total === 0 ? 0 : (inboundCount / total) * 100;

  const summary = [
    `Real site traffic over the last 30 days: ${total} recorded event(s) across ${ranked.length} path(s).`,
    ranked.length
      ? `Top paths: ${ranked.slice(0, 6).map(([path, n]) => `${path} (${n})`).join(", ")}.`
      : "No page views were recorded, so nothing can be said about which pages work.",
    inboundCount > 0
      ? `${inboundCount} real enquiry/payment item(s) reached the office from those visits (${conversion.toFixed(1)}% of recorded events).`
      : "No enquiries have arrived from the site yet. Traffic without an enquiry is not pipeline.",
    rateCardIntegrity().detail,
    "Channels: the office publishes on its own site only. No media is bought and no budget is committed.",
  ].join("\n");

  const id = await fileDocument({
    title: `Site signals · ${new Date().toISOString().slice(0, 10)}`,
    kind: "internal",
    summary,
  });
  void id;
  return noop(`Recorded a site-signal note from ${total} real events.`);
}

const prospectFromSiteSignals: Runner = async (item, _view) => {
  const path = str(item.payload.path);
  const count = intOf(item.payload.visitCount, 1);
  const scored = scoreLead(`${count} recorded visit(s) to ${path} with no enquiry filed yet.`, `Prospect · ${path}`);
  const result = await applyProposedAction(
    "signal",
    {
      kind: "create_lead",
      title: `Prospect · ${path}`,
      rationale: `Repeat interest from the site: ${count} recorded visit(s) to ${path} with no enquiry filed. This is a flagged interest, not a confirmed buyer, and no customer contact is known.`,
      confidence: 0.75,
      amountCents: 0,
      companyName: `Prospect · ${path}`,
      payload: {
        source: "site_signal",
        stage: "engaged",
        score: scored.score,
        evidence: `${count} recorded visit(s) to ${path}; no enquiry follows them yet.`,
      },
    },
    { source: "scheduler", workItem: item.id },
  );
  return {
    outcome: `Prospected ${path}: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

const writeContentBrief: Runner = async (item, view) => {
  const cheapest = [...PRICE_GUIDE].sort((a, b) => a.cents - b.cents)[0];
  const paths = new Set(view.siteEvents.map((event) => event.path));
  const untouched = ["/rates", "/work", "/support", "/services/voip", "/services/networking", "/services/it-infrastructure"].filter(
    (path) => !paths.has(path),
  );
  const summary = [
    `Brief for the next owned-site piece. Written because ${item.reason}`,
    "",
    `Audience: an office or operator who runs real VoIP, networking and IT infrastructure and is tired of vague answers.`,
    `The page must earn its place by answering a question a buyer actually asks. It must not claim 24/7 cover, certifications, response times or a lowest price — ${COMPANY.legalName} cannot evidence those.`,
    `It must quote only published labour: ${cheapest.price} (${cheapest.title}) and the rest of the rate card. Managed support is not offered and must not be implied.`,
    "",
    untouched.length
      ? `Pages with no recorded traffic in this window: ${untouched.join(", ")}. Check whether they are unreachable, unlinked, or simply unwanted before writing anything new.`
      : "Every published service page has recorded traffic. Extend what is working rather than adding a new page.",
    "",
    "Publication is a founder decision. This brief is a draft until it is approved.",
  ].join("\n");
  await fileDocument({ title: `Content brief · ${new Date().toISOString().slice(0, 10)}`, kind: "content_brief", summary });
  return noop("Wrote a content brief for the founder to approve.");
};

const qualifyLead: Runner = async (item) => {
  const leadId = str(item.payload.leadId);
  const score = intOf(item.payload.score, 40);
  const reasons = Array.isArray(item.payload.reasons) ? (item.payload.reasons as string[]) : [];
  const spam = item.payload.spam === true;
  const stage = spam ? "disqualified" : score >= 45 ? "qualified" : "nurture";
  const summary = spam
    ? `Disqualified: ${reasons.join("; ") || "reads as unsolicited outreach"}.`
    : `Score ${score}/100. ${reasons.join("; ") || "No demand signal found."}`;

  const result = await applyProposedAction(
    "signal",
    {
      kind: "update_lead",
      title: `${stage === "disqualified" ? "Disqualified" : "Scored"} ${str(item.payload.companyName)}`,
      rationale: summary,
      confidence: spam ? 0.92 : 0.8,
      amountCents: 0,
      relatedId: leadId,
      payload: { stage, score },
    },
    { source: "scheduler", workItem: item.id },
  );
  return {
    outcome: `${leadId} → ${stage}: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

const proposeSalesHandoff: Runner = async (item) => {
  const leadId = str(item.payload.leadId);
  const companyName = str(item.payload.companyName);
  const reasons = Array.isArray(item.payload.reasons) ? (item.payload.reasons as string[]) : [];
  const result = await applyProposedAction(
    "signal",
    {
      kind: "handoff_to_sales",
      title: `Hand ${companyName} to sales`,
      rationale: `Marketing stops here. ${reasons.join("; ")} Score ${str(item.payload.score)}/100. The founder decides whether this becomes a sale.`,
      confidence: 0.78,
      amountCents: 0,
      companyName,
      relatedId: leadId,
      payload: { score: intOf(item.payload.score, 0) },
    },
    { source: "scheduler", workItem: item.id },
  );
    return {
      outcome: `Handoff proposed for ${companyName}: ${result.status}`,
      executed: result.status === "executed" ? 1 : 0,
      escalated: result.status === "escalated" ? 1 : 0,
      blocked: result.status === "blocked" ? 1 : 0,
    };
}

const draftCampaign: Runner = async (item) => {
  const channel = str(item.payload.channel, "owned");
  const leads = Array.isArray(item.payload.leads) ? (item.payload.leads as { id: string; companyName: string; stage: string; score: number }[]) : [];
  const result = await applyProposedAction(
    "signal",
    {
      kind: "draft_campaign",
      title: `Owned-channel campaign · ${new Date().toISOString().slice(0, 10)}`,
      rationale: [
        `Draft campaign for ${leads.length} nurtured lead(s) who are not yet in sales.`,
        ...leads.map((lead) => `- ${lead.companyName} (${lead.stage}, score ${lead.score})`),
        "This is organic, owned-channel work. No media is bought and no budget is committed. Activation and any spend wait on your approval.",
      ].join("\n"),
      confidence: 0.8,
      amountCents: 0,
      payload: { channel, budgetCents: 0, leads },
    },
    { source: "scheduler", workItem: item.id },
  );
  return {
    outcome: `Campaign drafted: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

// ── CLOSE (sales) ─────────────────────────────────────────────────────────────

const advanceDiscovery: Runner = async (item) => {
  const opportunityId = str(item.payload.opportunityId);
  const companyName = str(item.payload.companyName);
  const result = await applyProposedAction(
    "close",
    {
      kind: "advance_opportunity",
      title: `Discovery pack prepared for ${companyName}`,
      rationale: [
        "Discovery for a VoIP, networking or infrastructure enquiry.",
        "Before a figure can be quoted, these must be confirmed: the systems in scope, who administers them, the access the work needs, the acceptance check, and the schedule the customer can accept.",
        `${COMPANY.legalName} quotes published labour only. Ranges, retainers, travel and supplier charges are quoted separately and approved by the founder.`,
        "The next step is a written scope and a priced quote, both approved before work starts.",
      ].join(" "),
      confidence: 0.8,
      amountCents: 0,
      companyName,
      relatedId: opportunityId,
      payload: { stage: "discovery" },
    },
    { source: "scheduler", workItem: item.id },
  );
  await fileDocument({
    title: `Discovery checklist · ${companyName}`,
    kind: "internal",
    status: "draft",
    summary: [
      `Discovery checklist for ${companyName}.`,
      "1. Which systems are in scope, and which are explicitly not?",
      "2. Who administers them, and do we have lawful access?",
      "3. What is the acceptance check for 'fixed'?",
      "4. What schedule can the customer accept?",
      "5. Which published rate applies: remote or on-site?",
      "6. Are travel, hardware, licences or carrier charges needed? They are quoted separately.",
    ].join("\n"),
    relatedId: opportunityId,
  });
  return {
    outcome: `Discovery recorded for ${companyName}: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

/**
 * Follow up on a real, waiting quote. The letter is a DRAFT: it is written to the
 * documents table for the founder to review and send. Nothing is emailed here,
 * because an unreviewed message to a customer is a commitment the office cannot
 * make on the founder's behalf.
 */
const draftQuoteFollowUp: Runner = async (item) => {
  const companyName = str(item.payload.companyName);
  const days = intOf(item.payload.daysWaiting, 1);
  const views = intOf(item.payload.views, 0);
  const value = intOf(item.payload.valueCents, 0);
  const letter = [
    `Hello ${companyName},`,
    "",
    `Following up on the quote ${str(item.payload.quoteId)} issued ${days} day${days === 1 ? "" : "s"} ago.`,
    views > 0
      ? "The link was opened but nothing has come back yet, so we are checking the scope and figures still stand."
      : "We have not seen the quote opened, so we are checking that it arrived and that the figures are still right.",
    "",
    "Nothing has changed: the scope, the labour rate, and the exclusions are as written. If any part of it does not match what you actually need, tell us what differs and we will requote rather than defend it.",
    "",
    "If the work has moved on, a short note saying so is genuinely useful and we will close the file cleanly.",
    "",
    `${COMPANY.legalName}`,
  ].join("\n");

  await fileDocument({
    title: `Quote follow-up · ${companyName} · ${days}d`,
    kind: "follow_up",
    status: "draft",
    summary: letter,
    relatedId: str(item.payload.opportunityId),
  });
  return noop(
    `Drafted a follow-up for ${companyName} (${formatZar(value)}, ${days}d, ${views} view(s)). Not emailed.`,
  );
};

const reviewColdProposal: Runner = async (item) => {
  const result = await applyProposedAction(
    "close",
    {
      kind: "notify_operator",
      title: `Cold proposal · ${str(item.payload.companyName)}`,
      rationale: `${item.reason} Sales may not mark this lost without the founder deciding.`,
      confidence: 0.75,
      amountCents: 0,
      companyName: str(item.payload.companyName),
      relatedId: str(item.payload.opportunityId),
      payload: {},
    },
    { source: "scheduler", workItem: item.id },
  );
  return {
    outcome: `Cold proposal reported: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

const nudgeInvoice: Runner = async (item) => {
  const result = await applyProposedAction(
    "close",
    {
      kind: "notify_operator",
      title: `${str(item.payload.companyName)} is won and ready to invoice`,
      rationale: `${item.reason} Ledger raises the invoice; Sales cannot book one.`,
      confidence: 0.9,
      amountCents: 0,
      companyName: str(item.payload.companyName),
      relatedId: str(item.payload.opportunityId),
      payload: {},
    },
    { source: "scheduler", workItem: item.id },
  );
  return {
    outcome: `Invoice nudge raised: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

// ── DESK (customer service) ───────────────────────────────────────────────────

const acknowledgeTicket: Runner = async (item) => {
  const ticketId = str(item.payload.ticketId);
  const letter = [
    "We have your service request and it is on the board.",
    "Nothing is confirmed yet: not a cause, not a fix, not a time. Those come from the work, not from this note.",
    "If anything changes that affects the site, tell us and we will use the updated information.",
  ].join("\n");
  const sql = await getSql();
  const ticket = await sql<{ related_id: string | null; summary: string }>`
    select related_id, summary from tickets where id = ${ticketId}
  `.then((rows) => rows[0]);
  if (!ticket) return noop("Ticket no longer exists.");
  const companyName = await resolveCompany(ticket.related_id);
  const id = await fileDocument({
    title: `Service acknowledgement · ${ticketId.slice(0, 8)}`,
    kind: "service_ack",
    status: "draft",
    summary: letter,
    relatedId: ticketId,
  });
  const result = await applyProposedAction(
    "desk",
    {
      kind: "update_ticket",
      title: `Acknowledged · ${str(item.payload.title)}`,
      rationale: `Customer acknowledgement drafted as ${id}. It has not been sent.`,
      confidence: 0.85,
      amountCents: 0,
      companyName,
      relatedId: ticketId,
      payload: { status: "in_progress" },
    },
    { source: "scheduler", workItem: item.id },
  );
  return {
    outcome: `Acknowledged ${ticketId.slice(0, 8)}: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

const escalateAgeingTicket: Runner = async (item) => {
  const result = await applyProposedAction(
    "desk",
    {
      kind: "escalate_account_risk",
      title: `Ageing service request · ${str(item.payload.title)}`,
      rationale: `${item.reason} No refund, credit, cancellation or new commitment is made here.`,
      confidence: 0.9,
      amountCents: 0,
      relatedId: str(item.payload.ticketId),
      payload: {},
    },
    { source: "scheduler", workItem: item.id },
  );
  return {
    outcome: `Ageing ticket escalated: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

const draftChatReply: Runner = async (item) => {
  const name = str(item.payload.name) || "there";
  const threadId = str(item.payload.threadId);
  const { readChat } = await import("./chat.server");
  const messages = await readChat(threadId);
  const lastCustomer = [...messages].reverse().find((message) => message.role === "customer");
  const question = lastCustomer?.body ?? "";
  const letter = [
    `Hello ${name},`,
    "",
    "Thanks for the message. It has reached the desk and is on file.",
    question
      ? `On your question — "${question.slice(0, 200)}" — the honest answer is that we need to look at the system before we say anything definitive. We will come back with what we find, not with a guess.`
      : "We will come back to you once we have looked at it properly.",
    "",
    "We are not going to quote a cause, a fix or a time from a chat window.",
    "",
    `${COMPANY.legalName}`,
  ].join("\n");
  await fileDocument({
    title: `Chat reply · ${name}`,
    kind: "correspondence",
    status: "draft",
    summary: letter,
  });
  return noop(`Drafted a chat reply for ${name}. Not sent.`);
};

// ── FORGE (technical) ─────────────────────────────────────────────────────────

const diagnoseTicket: Runner = async (item) => {
  const { technicalFix } = await import("./floor");
  const procedure = technicalFix(str(item.payload.summary));
  const sql = await getSql();
  const claimed = await sql<{ id: string }>`
    update tickets
    set status = 'in_progress', summary = ${procedure}, updated_at = now()
    where id = ${str(item.payload.ticketId)} and status = 'open'
    returning id
  `;
  if (!claimed.length) return noop("Ticket was already being worked.");
  const result = await applyProposedAction(
    "forge",
    {
      kind: "update_ticket",
      title: `Procedure written · ${str(item.payload.title)}`,
      rationale: procedure,
      confidence: 0.85,
      amountCents: 0,
      relatedId: str(item.payload.ticketId),
      payload: { status: "in_progress" },
    },
    { source: "scheduler", workItem: item.id },
  );
  return {
    outcome: `Procedure written for ${str(item.payload.ticketId).slice(0, 8)}: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

const recordKnowledge: Runner = async (item) => {
  const sql = await getSql();
  const ticket = await sql<{ summary: string; title: string }>`
    select summary, title from tickets where id = ${str(item.payload.ticketId)}
  `.then((rows) => rows[0]);
  if (!ticket) return noop("Ticket no longer exists.");
  const body = ticket.summary.replace(/^FORGE:\s*/, "").split("Customer equipment")[0].trim();
  await fileDocument({
    title: `Known fault · ${ticket.title}`,
    kind: "knowledge",
    status: "recorded",
    summary: `# ${ticket.title}\n\n${body}\n\nThis is a procedure, not a claim that the fault was fixed. Customer equipment was not accessed from this office.`,
    relatedId: str(item.payload.ticketId),
  });
  return noop("Recorded the procedure in the knowledge base.");
};

// ── LEDGER (finance) ──────────────────────────────────────────────────────────

const draftInvoiceChase: Runner = async (item) => {
  const counterparty = str(item.payload.counterparty);
  const amount = intOf(item.payload.amountCents, 0);
  const { invoiceCopy } = await import("./invoice");
  const reference = str(item.payload.invoiceId);
  const letter = [
    `Hello ${counterparty},`,
    "",
    `Our invoice ${reference} for ${formatZar(amount)} has been outstanding since we issued it.`,
    "This is a reminder, not a demand and not a statement that anything is wrong. If the invoice is not what you expected, say so and we will look at it before anything else.",
    "If payment is already on its way, ignore this and it will clear on our side.",
    "",
    "No interest, penalty or credit note is applied by this message.",
    "",
    `${COMPANY.legalName}`,
  ].join("\n");
  void invoiceCopy;
  await fileDocument({
    title: `Invoice reminder · ${counterparty} · ${formatZar(amount)}`,
    kind: "follow_up",
    status: "draft",
    summary: letter,
    relatedId: reference,
  });
  return noop(`Drafted an invoice reminder for ${counterparty} (${formatZar(amount)}). Not emailed.`);
};

const verifyPaymentNotice: Runner = async (item) => {
  const result = await applyProposedAction(
    "ledger",
    {
      kind: "notify_operator",
      title: `Payment notice to confirm · ${str(item.payload.companyName)}`,
      rationale: `${item.reason} Treasury only moves when the founder confirms the money actually arrived, against an invoice that exists.`,
      confidence: 0.95,
      amountCents: 0,
      companyName: str(item.payload.companyName),
      relatedId: str(item.payload.inboundId),
      payload: {},
    },
    { source: "scheduler", workItem: item.id },
  );
  return {
    outcome: `Payment notice flagged for confirmation: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

const reportPayables: Runner = async (item) => {
  const result = await applyProposedAction(
    "ledger",
    {
      kind: "notify_operator",
      title: "Payables need a payment decision",
      rationale: `${item.reason} Ledger may not schedule a payment. That is a founder decision.`,
      confidence: 0.95,
      amountCents: 0,
      payload: {},
    },
    { source: "scheduler", workItem: item.id },
  );
  return {
    outcome: `Payables reported: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

// ── KEEP (admin) ──────────────────────────────────────────────────────────────

const fileMissingRecords: Runner = async (item) => {
  const result = await applyProposedAction(
    "keep",
    {
      kind: "notify_operator",
      title: `Records incomplete · ${str(item.payload.companyName)}`,
      rationale: `${item.reason} Nothing is deleted and nothing is invented; the gap is reported so the founder can close it.`,
      confidence: 0.9,
      amountCents: 0,
      companyName: str(item.payload.companyName),
      relatedId: str(item.payload.opportunityId),
      payload: {},
    },
    { source: "scheduler", workItem: item.id },
  );
  return {
    outcome: `Records gap reported: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

// ── SEAL (compliance) ─────────────────────────────────────────────────────────

/**
 * A broken audit chain stops the office. This is the one duty with the authority
 * to halt, because an office that cannot prove what it did must not keep acting
 * autonomously.
 */
const haltBrokenChain: Runner = async (item) => {
  await setOfficeHalt(true, `SEAL halted autonomous operations: ${item.reason}`);
  await sendFounderAlert(
    "The audit chain failed verification",
    `${item.reason} Autonomous actions are stopped. Resume from the office once the chain is understood.`,
    "/office/audit",
  );
  return noop("Office halted because the audit chain did not verify.");
};

const reportScopeDrift: Runner = async (item) => {
  const result = await applyProposedAction(
    "seal",
    {
      kind: "notify_operator",
      title: "Possible role drift detected",
      rationale: item.reason,
      confidence: 0.85,
      amountCents: 0,
      payload: {},
    },
    { source: "scheduler", workItem: item.id },
  );
  return {
    outcome: `Scope drift reported: ${result.status}`,
    executed: result.status === "executed" ? 1 : 0,
    escalated: result.status === "escalated" ? 1 : 0,
    blocked: result.status === "blocked" ? 1 : 0,
  };
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const RUNNERS: Record<string, Runner> = {
  report_silent_agent: reportSilentAgent,
  report_stuck_backlog: reportStuckBacklog,
  report_abandoned_work: reportAbandonedWork,
  route_inbound: routeInbound,
  classify_inbound: classifyInbound,
  escalate_stale_enquiry: escalateStaleEnquiry,
  analyse_site_signals: analyseSiteSignals,
  write_content_brief: writeContentBrief,
  qualify_lead: qualifyLead,
  propose_sales_handoff: proposeSalesHandoff,
  prospect_from_site_signals: prospectFromSiteSignals,
  draft_campaign: draftCampaign,
  advance_discovery: advanceDiscovery,
  draft_quote_followup: draftQuoteFollowUp,
  review_cold_proposal: reviewColdProposal,
  nudge_invoice: nudgeInvoice,
  acknowledge_ticket: acknowledgeTicket,
  escalate_ageing_ticket: escalateAgeingTicket,
  draft_chat_reply: draftChatReply,
  diagnose_ticket: diagnoseTicket,
  record_knowledge: recordKnowledge,
  draft_invoice_chase: draftInvoiceChase,
  verify_payment_notice: verifyPaymentNotice,
  report_payables: reportPayables,
  file_missing_records: fileMissingRecords,
  halt_broken_chain: haltBrokenChain,
  report_scope_drift: reportScopeDrift,
};

async function resolveCompany(relatedId: string | null): Promise<string> {
  if (!relatedId) return "the customer";
  const sql = await getSql();
  const row = await sql<{ company_name: string }>`
    select company_name from opportunities where id = ${relatedId}
  `.then((rows) => rows[0]);
  return row?.company_name ?? "the customer";
}

async function sendFounderAlert(title: string, detail: string, where?: string): Promise<void> {
  try {
    const { deliverFounderNotice } = await import("./notify.server");
    const { founderOfficeAlertNotice } = await import("./notice");
    await deliverFounderNotice(founderOfficeAlertNotice({ title, detail, where }));
  } catch {
    // Already recorded in the audit trail; the office screen is the backstop.
  }
}

export { heartbeat, sendCustomerMail, applyProposedAction, fileDocument, str, intOf };
export type { PlannedWork };