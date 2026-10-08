import { createServerFn } from "@tanstack/react-start";
import { AGENT_BY_ID } from "./agents";
import { proposeActions } from "./ai.server";
import { listChats, founderReply, postChat, readChat } from "./chat.server";
import { processWebsiteEnquiry } from "./intake";
import { founderChatNotice, founderEnquiryNotice, founderPaymentNotice } from "./notice";
import { founderMiddleware, officeAccessMiddleware } from "./founder-gate";
import { priceQuote, type QuoteLocation } from "./quote";
import {
  applyProposedAction,
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

const enquiryHits = new Map<string, number[]>();

function clientKey(request: Request | undefined): string {
  const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request?.headers.get("cf-connecting-ip") || "local";
}

function allowEnquiry(key: string): boolean {
  const now = Date.now();
  const recent = (enquiryHits.get(key) ?? []).filter((stamp) => now - stamp < 60 * 60 * 1000);
  if (recent.length >= 8) {
    enquiryHits.set(key, recent);
    return false;
  }
  recent.push(now);
  enquiryHits.set(key, recent);
  return true;
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
    if (data.website?.trim()) return { ok: true as const };
    const name = data.name.trim();
    const email = data.email.trim();
    const message = data.message.trim();
    const matter = serviceMatter(data.matter);
    const desk = data.desk === true || matter !== undefined;
    if (name.length < 2 || name.length > 160) {
      return { ok: false as const, error: "Enter the name we should use." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
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
    if (!allowEnquiry(clientKey(request))) {
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
    if (data.website?.trim()) return { ok: true as const };
    const email = data.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return { ok: false as const, error: "Enter a real email address." };
    }
    let request: Request | undefined;
    try {
      const server = await import("@tanstack/react-start/server");
      request = server.getRequest();
    } catch {
      request = undefined;
    }
    if (!allowEnquiry(clientKey(request))) {
      return { ok: false as const, error: "Too many notices from this connection. Try again later." };
    }
    const filed = await filePaymentNotice({
      name: data.name,
      email,
      reference: data.reference,
      amount: data.amount,
    });
    if (!filed.ok) return filed;
    try {
      const { parsePaymentNotice } = await import("./payment-notice");
      const parsed = parsePaymentNotice({ name: data.name, reference: data.reference, amount: data.amount });
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

const chatHits = new Map<string, number[]>();

export const postPublicChat = createServerFn({ method: "POST" })
  .validator((input: { threadId: string; name: string; body: string; website?: string }) => input)
  .handler(async ({ data }) => {
    if (data.website?.trim()) return { ok: true as const, messages: [] };
    let request: Request | undefined;
    try {
      const server = await import("@tanstack/react-start/server");
      request = server.getRequest();
    } catch {
      request = undefined;
    }
    const key = clientKey(request);
    const now = Date.now();
    const recent = (chatHits.get(key) ?? []).filter((stamp) => now - stamp < 60 * 60 * 1000);
    if (recent.length >= 40) return { ok: false as const, error: "Too many messages from this connection. Try again later." };
    recent.push(now);
    chatHits.set(key, recent);
    const result = await postChat({ threadId: data.threadId, name: data.name, body: data.body });
    if (!result.ok) return result;
    if (result.first) {
      try {
        const { deliverFounderNotice } = await import("./notify.server");
        await deliverFounderNotice(founderChatNotice({ name: data.name, excerpt: data.body }));
      } catch {
        // The chat is already on file.
      }
    }
    return { ok: true as const, messages: result.messages };
  });

export const readPublicChat = createServerFn({ method: "POST" })
  .validator((input: { threadId: string }) => input)
  .handler(async ({ data }) => ({ messages: await readChat(data.threadId) }));

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
  .validator((input: { opportunityId: string }) => input)
  .handler(async ({ data }) => raiseQuoteInvoice(data.opportunityId));

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
