import { createServerFn } from "@tanstack/react-start";
import { clientKey, createRateLimiter, str, validEmail } from "./guard";
import { durableAllow } from "./rate-limit";
import { parseVatTreatment, paymentMethods } from "./invoice";
import { getSql } from "@/lib/db";
import { AGENT_BY_ID } from "./agents";
import { proposeActions } from "./ai.server";
import { listChats, founderReply, postChat, readChat } from "./chat.server";
import { processWebsiteEnquiry } from "./intake";
import { founderChatNotice, founderEnquiryNotice, founderPaymentNotice, founderQuoteAnswerNotice } from "./notice";
import { parseCustomerAnswer, plausibleToken } from "./quote-link";
import { founderMiddleware, officeAccessMiddleware } from "./founder-gate";
import { priceQuote, type QuoteLocation } from "./quote";
import {
  answerPublicQuote,
  applyProposedAction,
  createQuoteLink,
  listQuoteLinks,
  readPublicQuote,
  revokeQuoteLinks,
  exportBackupJson,
  restoreBackupJson,
  compactState,
  ensureOffice,
  filePaymentNotice,
  founderClose,
  logInboundItem,
  raiseQuoteInvoice,
  readSnapshot,
  recordInvoiceReceipt,
  dismissPaymentNotice,
  resolveApproval,
  savePaymentInstructions,
  setOfficeHalt,
  setTicketStatus,
} from "./store.server";
import type { DispatchResult, OfficeSnapshot, ProposedAction } from "./types";

async function applyPlan(
  agentId: string,
  task: string,
  actions: ProposedAction[],
  briefing: string,
): Promise<DispatchResult> {
  const agent = AGENT_BY_ID[agentId];
  const decisionIds: string[] = [];
  const approvalIds: string[] = [];
  let executed = 0;
  let escalated = 0;
  let blocked = 0;

  for (const action of actions) {
    const result = await applyProposedAction(agentId, action, {
      task,
      agent: agent?.callsign ?? agentId,
    });
    decisionIds.push(result.decisionId);
    if (result.approvalId) approvalIds.push(result.approvalId);
    if (result.status === "executed") executed += 1;
    else if (result.status === "escalated") escalated += 1;
    else blocked += 1;
  }

  return {
    ok: true,
    briefing,
    executed,
    escalated,
    blocked,
    decisionIds,
    approvalIds,
  };
}

function emptyFail(error: string): DispatchResult {
  return {
    ok: false,
    briefing: "",
    error,
    executed: 0,
    escalated: 0,
    blocked: 0,
    decisionIds: [],
    approvalIds: [],
  };
}

export const getOfficeSnapshot = createServerFn({ method: "GET" })
  .middleware([officeAccessMiddleware])
  .handler(async ({ context }): Promise<{ locked: true } | { locked: false; snapshot: OfficeSnapshot }> => {
    if (!context.founder) return { locked: true };
    return { locked: false, snapshot: await readSnapshot() };
  });

const enquiryLimiter = createRateLimiter(8, 60 * 60 * 1000);
const paymentLimiter = createRateLimiter(8, 60 * 60 * 1000);
const chatLimiter = createRateLimiter(40, 60 * 60 * 1000);
const chatReadLimiter = createRateLimiter(120, 60 * 60 * 1000);

function callerKey(request: Request | undefined): string {
  return clientKey(request?.headers);
}

async function allowEnquiry(key: string): Promise<boolean> {
  if (!enquiryLimiter.allow(key)) return false;
  return durableAllow(await getSql(), "enquiry", key, 8, 60 * 60 * 1000, Date.now(), () => enquiryLimiter.allow(key));
}

async function allowPaymentNotice(key: string): Promise<boolean> {
  if (!paymentLimiter.allow(key)) return false;
  return durableAllow(await getSql(), "payment_notice", key, 8, 60 * 60 * 1000, Date.now(), () => paymentLimiter.allow(key));
}

async function allowChat(key: string): Promise<boolean> {
  if (!chatLimiter.allow(key)) return false;
  return durableAllow(await getSql(), "chat", key, 40, 60 * 60 * 1000, Date.now(), () => chatLimiter.allow(key));
}

async function allowChatRead(key: string): Promise<boolean> {
  if (!chatReadLimiter.allow(key)) return false;
  return durableAllow(await getSql(), "chat_read", key, 120, 60 * 60 * 1000, Date.now(), () => chatReadLimiter.allow(key));
}

const SERVICE_MATTERS = ["fault", "question", "complaint"] as const;

function serviceMatter(value: unknown): (typeof SERVICE_MATTERS)[number] | undefined {
  return SERVICE_MATTERS.find((matter) => matter === value);
}

export const submitPublicEnquiry = createServerFn({ method: "POST" })
  .validator(
    (input: { name: string; email: string; message: string; website?: string; desk?: boolean; matter?: string }) =>
      input,
  )
  .handler(async ({ data }) => {
    if (str(data.website, 200).trim()) return { ok: true as const };
    const name = str(data.name, 400).trim();
    const email = str(data.email, 400).trim();
    const message = str(data.message, 6000).trim();
    const matter = serviceMatter(data.matter);
    const desk = data.desk === true || matter !== undefined;
    if (name.length < 2 || name.length > 160) {
      return { ok: false as const, error: "Enter the name we should use." };
    }
    if (!validEmail(email)) {
      return { ok: false as const, error: "Enter a real email address." };
    }
    if (message.length < 5 || message.length > 3000) {
      return { ok: false as const, error: "Describe the work in a few sentences." };
    }
    let request: Request | undefined;
    try {
      const server = await import("@tanstack/react-start/server");
      request = server.getRequest();
    } catch {
      request = undefined;
    }
    if (!(await allowEnquiry(callerKey(request)))) {
      return { ok: false as const, error: "Too many enquiries from this connection. Try again later." };
    }
    const subject = message.replace(/\s+/g, " ").slice(0, 90);
    const source = desk
      ? "Source: vantage-ars.co.za customer service desk. No automated reply sent."
      : "Source: vantage-ars.co.za enquiry form. No automated reply sent.";
    const id = await logInboundItem({
      channel: "web",
      companyName: name,
      subject,
      summary: `Email: ${email}\n${source}${matter ? `\nMatter: ${matter}` : ""}\n\n${message}`,
      intent: desk ? "support" : "enquiry",
    });
    const snapshot = await readSnapshot();
    if (!snapshot.company.halted) {
      try {
        await processWebsiteEnquiry({ inboundId: id, name, message, desk, matter });
      } catch {
        // The enquiry is already on file. Routing can be retried from the inbox.
      }
    }
    try {
      const { deliverFounderNotice } = await import("./notify.server");
      await deliverFounderNotice(
        founderEnquiryNotice({
          name,
          email,
          subject,
          desk,
          excerpt: message,
        }),
      );
    } catch {
      // The enquiry is already on file.
    }
    return { ok: true as const };
  });

export const submitPaymentNotice = createServerFn({ method: "POST" })
  .validator((input: { name: string; email: string; reference: string; amount: string; website?: string }) => input)
  .handler(async ({ data }) => {
    if (str(data.website, 200).trim()) return { ok: true as const };
    const email = str(data.email, 400).trim();
    if (!validEmail(email)) {
      return { ok: false as const, error: "Enter a real email address." };
    }
    let request: Request | undefined;
    try {
      const server = await import("@tanstack/react-start/server");
      request = server.getRequest();
    } catch {
      request = undefined;
    }
    if (!(await allowPaymentNotice(callerKey(request)))) {
      return { ok: false as const, error: "Too many notices from this connection. Try again later." };
    }
    const filed = await filePaymentNotice({
      name: str(data.name, 400),
      email,
      reference: str(data.reference, 400),
      amount: str(data.amount, 100),
    });
    if (!filed.ok) return filed;
    try {
      const { parsePaymentNotice } = await import("./payment-notice");
      const parsed = parsePaymentNotice({
        name: str(data.name, 400),
        reference: str(data.reference, 400),
        amount: str(data.amount, 100),
      });
      if (parsed.ok) {
        const { deliverFounderNotice } = await import("./notify.server");
        await deliverFounderNotice(
          founderPaymentNotice({
            name: parsed.name,
            email,
            reference: parsed.reference,
            cents: parsed.cents,
          }),
        );
      }
    } catch {
      // The notice is already on file.
    }
    return { ok: true as const };
  });

export const filePaymentClaim = createServerFn({ method: "POST" })
  .middleware([founderMiddleware])
  .validator((input: { inboundId: string }) => input)
  .handler(async ({ data }) => dismissPaymentNotice(data.inboundId));

export const postPublicChat = createServerFn({ method: "POST" })
  .validator((input: { threadId: string; name: string; body: string; website?: string }) => input)
  .handler(async ({ data }) => {
    if (str(data.website, 200).trim()) return { ok: true as const, messages: [] };
    let request: Request | undefined;
    try {
      const server = await import("@tanstack/react-start/server");
      request = server.getRequest();
    } catch {
      request = undefined;
    }
    if (!(await allowChat(callerKey(request)))) {
      return { ok: false as const, error: "Too many messages from this connection. Try again later." };
    }
    const chatSender = str(data.name, 200);
    const chatText = str(data.body, 2000);
    const result = await postChat({ threadId: str(data.threadId, 80), name: chatSender, body: chatText });
    if (!result.ok) return result;
    if (result.first) {
      try {
        const { deliverFounderNotice } = await import("./notify.server");
        await deliverFounderNotice(founderChatNotice({ name: chatSender, excerpt: chatText }));
      } catch {
        // The chat is already on file.
      }
    }
    return { ok: true as const, messages: result.messages };
  });

export const readPublicChat = createServerFn({ method: "POST" })
  .validator((input: { threadId: string }) => input)
  .handler(async ({ data }) => {
    const threadId = str(data.threadId, 80);
    let request: Request | undefined;
    try {
      const server = await import("@tanstack/react-start/server");
      request = server.getRequest();
    } catch {
      request = undefined;
    }
    if (!(await allowChatRead(callerKey(request)))) {
      return { ok: false as const, error: "Too many chat requests from this connection. Try again later." };
    }
    return { ok: true as const, messages: await readChat(threadId) };
  });

export const listOfficeChats = createServerFn({ method: "GET" })
  .middleware([founderMiddleware])
  .handler(async () => listChats());

export const replyOfficeChat = createServerFn({ method: "POST" })
  .middleware([founderMiddleware])
  .validator((input: { threadId: string; body: string }) => input)
  .handler(async ({ data }) => founderReply(data.threadId, data.body));

export const haltOffice = createServerFn({ method: "POST" })
  .middleware([founderMiddleware])
  .validator((input: { halted: boolean; reason: string }) => input)
  .handler(async ({ data }) => {
    const reason = data.reason.trim() || (data.halted ? "Founder halt." : "Resumed.");
    await setOfficeHalt(data.halted, reason);
    return readSnapshot();
  });

export const submitInbound = createServerFn({ method: "POST" })
  .middleware([founderMiddleware])
  .validator((input: {
    channel: string;
    companyName: string;
    subject: string;
    summary: string;
    intent: string;
  }) => input)
  .handler(async ({ data }) => {
    const companyName = data.companyName.trim();
    const subject = data.subject.trim();
    const summary = data.summary.trim();
    if (!companyName || !subject || !summary) {
      return { ok: false as const, error: "Company, subject, and summary are required." };
    }
    const id = await logInboundItem({
      channel: data.channel.trim() || "direct",
      companyName,
      subject,
      summary,
      intent: data.intent.trim() || "unclassified",
    });

    const snapshot = await readSnapshot();
    if (snapshot.company.halted) {
      return { ok: true as const, id, routed: false as const };
    }

    const plan = await proposeActions({
      agentId: "foyer",
      task: [
        `Route inbound ${id} from company "${companyName}".`,
        `Channel: ${data.channel.trim() || "direct"}. Intent: ${data.intent.trim() || "unclassified"}.`,
        `Subject: ${subject}`,
        `Summary: ${summary}`,
        "Use relatedId of the inbound item. Create a lead only if this is genuine demand.",
        "Do not sell, quote, or spend. If it is support, open a ticket for FORGE.",
      ].join("\n"),
      state: compactState(snapshot),
    });

    if (!plan.ok) {
      return { ok: true as const, id, routed: false as const, briefing: plan.error };
    }

    const actions = plan.actions.map((action) => ({
      ...action,
      relatedId: action.relatedId || id,
      companyName: action.companyName || companyName,
    }));
    const dispatch = await applyPlan("foyer", `Route inbound ${id}`, actions, plan.briefing);
    return {
      ok: true as const,
      id,
      routed: true as const,
      briefing: dispatch.briefing,
      executed: dispatch.executed,
      escalated: dispatch.escalated,
      blocked: dispatch.blocked,
    };
  });

export const fileQuote = createServerFn({ method: "POST" })
  .middleware([founderMiddleware])
  .validator(
    (input: { opportunityId: string; rateId: string; location: QuoteLocation; quantity: number }) => input,
  )
  .handler(async ({ data }) => {
    const location: QuoteLocation = data.location === "onsite" ? "onsite" : "remote";
    const priced = priceQuote({
      rateId: data.rateId,
      location,
      quantity: Number(data.quantity),
    });
    if (!priced.ok) return { ok: false as const, error: priced.error };
    const snapshot = await readSnapshot();
    if (snapshot.company.halted) return { ok: false as const, error: "Office is halted." };
    const opportunity = snapshot.opportunities.find((item) => item.id === data.opportunityId);
    if (!opportunity) return { ok: false as const, error: "That opportunity is not on the pipeline." };
    if (opportunity.stage === "won" || opportunity.stage === "lost") {
      return { ok: false as const, error: "This opportunity is already closed." };
    }
    const result = await applyProposedAction(
      "close",
      {
        kind: "issue_quote",
        title: `Quote · ${priced.title}`,
        rationale: priced.detail,
        confidence: 0.92,
        amountCents: priced.cents,
        companyName: opportunity.companyName,
        relatedId: opportunity.id,
        payload: {
          rateId: data.rateId,
          location,
          quantity: Number(data.quantity),
          body: priced.body,
        },
      },
      { source: "sales-desk" },
    );
    if (result.status === "blocked") {
      return { ok: false as const, error: "Sales cannot quote this company yet. Approve the marketing handoff first." };
    }
    return { ok: true as const, status: result.status };
  });

export const recordCustomerAnswer = createServerFn({ method: "POST" })
  .middleware([founderMiddleware])
  .validator((input: { opportunityId: string; outcome: "won" | "lost" }) => input)
  .handler(async ({ data }) => {
    const outcome = data.outcome === "lost" ? "lost" : "won";
    return founderClose({ opportunityId: data.opportunityId, outcome });
  });

export const raiseInvoice = createServerFn({ method: "POST" })
  .middleware([founderMiddleware])
  .validator((input: { opportunityId: string; vatTreatment?: string }) => input)
  .handler(async ({ data }) => raiseQuoteInvoice(data.opportunityId, parseVatTreatment(data.vatTreatment)));

export const recordReceipt = createServerFn({ method: "POST" })
  .middleware([founderMiddleware])
  .validator((input: { invoiceId: string }) => input)
  .handler(async ({ data }) => recordInvoiceReceipt(data.invoiceId));

export const updateTicket = createServerFn({ method: "POST" })
  .middleware([founderMiddleware])
  .validator((input: { ticketId: string; status: "in_progress" | "resolved" }) => input)
  .handler(async ({ data }) => {
    const status = data.status === "resolved" ? "resolved" : "in_progress";
    return setTicketStatus(data.ticketId, status);
  });

export const savePaymentNote = createServerFn({ method: "POST" })
  .middleware([founderMiddleware])
  .validator((input: { text: string }) => input)
  .handler(async ({ data }) => savePaymentInstructions(data.text ?? ""));

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([founderMiddleware])
  .validator((input: { approvalId: string; decision: "approved" | "rejected"; note?: string }) => input)
  .handler(async ({ data }) => {
    const result = await resolveApproval(data);
    if (!result.ok) return { ok: false as const, error: result.error ?? "Could not resolve." };
    return { ok: true as const };
  });

export const dispatchAgent = createServerFn({ method: "POST" })
  .middleware([founderMiddleware])
  .validator((input: { agentId: string; task: string }) => input)
  .handler(async ({ data }): Promise<DispatchResult> => {
    await ensureOffice();
    const agent = AGENT_BY_ID[data.agentId];
    if (!agent) return emptyFail("Unknown agent.");
    const task = data.task.trim();
    if (task.length < 8) return emptyFail("Give the agent a real brief — at least a sentence.");

    const snapshot = await readSnapshot();
    if (snapshot.company.halted) return emptyFail("Office is halted. Resume before dispatching.");

    const plan = await proposeActions({
      agentId: data.agentId,
      task,
      state: compactState(snapshot),
    });
    if (!plan.ok) return emptyFail(plan.error);

    return applyPlan(data.agentId, task, plan.actions, plan.briefing);
  });

export const runFloor = createServerFn({ method: "POST" })
  .middleware([founderMiddleware])
  .handler(async (): Promise<DispatchResult> => {
    await ensureOffice();
    const snapshot = await readSnapshot();
    if (snapshot.company.halted) return emptyFail("Office is halted. Resume before running the floor.");
    const { operateFloor } = await import("./floor.server");
    const ran = await operateFloor();
    return {
      ok: true,
      briefing: ran.briefing,
      executed: ran.executed,
      escalated: 0,
      blocked: 0,
      decisionIds: [],
      approvalIds: [],
    };
  });

export const downloadBackup = createServerFn({ method: "POST" })
  .middleware([founderMiddleware])
  .handler(async () => ({ ok: true as const, filename: `vantage-ars-backup-${new Date().toISOString().slice(0, 10)}.json`, json: await exportBackupJson() }));

export const getPaymentMethods = createServerFn({ method: "GET" }).handler(async () => paymentMethods(process.env));

/**
 * Draft-only floor run for the scheduled `GET /api/cron/floor` route.
 * Authenticated by CRON_SECRET (NOT the founder session — the scheduler has
 * no cookies). Lives here so the `.server` imports stay inside an exempt
 * server-function handler; the TanStack route file only imports this module.
 */
export const runFloorCron = createServerFn({ method: "POST" })
  .validator((input: { secret: string }) => ({ secret: typeof input?.secret === "string" ? input.secret : "" }))
  .handler(async ({ data }): Promise<{ ok: boolean; executed?: number; briefing?: string; reason?: string }> => {
    const expected = process.env.CRON_SECRET?.trim() ?? "";
    if (expected.length < 16 || !secretEqual(data.secret, expected)) {
      return { ok: false, reason: "Unauthorized" };
    }
    if (process.env.AUTO_DRAFTS?.trim().toLowerCase() !== "on") {
      return { ok: false, reason: "AUTO_DRAFTS is not on." };
    }
    try {
      const { operateFloor } = await import("./floor.server");
      const result = await operateFloor({ sendMail: false });
      return { ok: true, executed: result.executed, briefing: result.briefing };
    } catch {
      return { ok: false, reason: "The run failed." };
    }
  });

/** Constant-time string compare without node:crypto (safe anywhere). */
function secretEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const restoreBackup = createServerFn({ method: "POST" })
  .middleware([founderMiddleware])
  .validator((input: { json: string }) => ({ json: typeof input?.json === "string" ? input.json : "" }))
  .handler(async ({ data }) => restoreBackupJson(data.json));

// ── Customer quote links ─────────────────────────────────────────────────────

const quoteViewLimiter = createRateLimiter(60, 60 * 60 * 1000);
const quoteAnswerLimiter = createRateLimiter(10, 60 * 60 * 1000);

async function currentRequest(): Promise<Request | undefined> {
  try {
    const server = await import("@tanstack/react-start/server");
    return server.getRequest();
  } catch {
    return undefined;
  }
}

export const listCustomerQuoteLinks = createServerFn({ method: "GET" })
  .middleware([founderMiddleware])
  .handler(async () => listQuoteLinks());

export const createCustomerQuoteLink = createServerFn({ method: "POST" })
  .middleware([founderMiddleware])
  .validator((input: { documentId: string }) => ({ documentId: str(input?.documentId, 100) }))
  .handler(async ({ data }) => createQuoteLink(data.documentId));

export const revokeCustomerQuoteLink = createServerFn({ method: "POST" })
  .middleware([founderMiddleware])
  .validator((input: { documentId: string }) => ({ documentId: str(input?.documentId, 100) }))
  .handler(async ({ data }) => revokeQuoteLinks(data.documentId));

export const getCustomerQuote = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => ({ token: str(input?.token, 100) }))
  .handler(async ({ data }) => {
    if (!plausibleToken(data.token)) return { ok: false as const, error: "This quote link is not valid. Ask us for a new one." };
    const key = callerKey(await currentRequest());
    if (!quoteViewLimiter.allow(key)) {
      return { ok: false as const, error: "Too many requests from this connection. Try again in a while." };
    }
    return readPublicQuote(data.token);
  });

export const answerCustomerQuote = createServerFn({ method: "POST" })
  .validator((input: { token: string; outcome: string; name: string; note?: string; agree?: boolean }) => input)
  .handler(async ({ data }) => {
    const token = str(data?.token, 100);
    if (!plausibleToken(token)) return { ok: false as const, error: "This quote link is not valid. Ask us for a new one." };
    const key = callerKey(await currentRequest());
    if (!quoteAnswerLimiter.allow(key)) {
      return { ok: false as const, error: "Too many attempts from this connection. Try again later." };
    }
    const parsed = parseCustomerAnswer({ outcome: data.outcome, name: data.name, note: data.note, agree: data.agree });
    if (!parsed.ok) return parsed;
    const result = await answerPublicQuote(token, parsed);
    if (!result.ok) return result;
    try {
      const { deliverFounderNotice } = await import("./notify.server");
      await deliverFounderNotice(
        founderQuoteAnswerNotice({
          companyName: result.companyName,
          outcome: parsed.outcome,
          name: parsed.name,
          amountCents: result.amountCents,
          note: parsed.note,
        }),
      );
    } catch {
      // The answer is already recorded.
    }
    return { ok: true as const, outcome: parsed.outcome };
  });
