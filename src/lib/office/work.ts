export type FounderWork = {
  id: string;
  title: string;
  detail: string;
  href:
    | "/office/approvals"
    | "/office/sales"
    | "/office/ledger"
    | "/office/technical"
    | "/office/service";
};

type WorkInput = {
  approvals: { id: string; status: string; title: string }[];
  documents: { id: string; kind: string; status: string; title: string }[];
  opportunities: { id: string; stage: string; companyName: string }[];
  ledger: {
    id: string;
    kind: string;
    status: string;
    relatedId: string | null;
    counterparty: string;
  }[];
  tickets: { id: string; status: string; ownerAgent: string; title: string }[];
  inbound?: { id: string; intent: string; status: string; subject: string }[];
};

export function founderWork(input: WorkInput): FounderWork[] {
  const items: FounderWork[] = [];
  for (const approval of input.approvals) {
    if (approval.status !== "pending") continue;
    items.push({
      id: `approval:${approval.id}`,
      title: approval.title,
      detail: "Needs your approval.",
      href: "/office/approvals",
    });
  }
  for (const item of input.inbound ?? []) {
    if (item.intent !== "payment_notice" || item.status === "filed") continue;
    items.push({
      id: `payment:${item.id}`,
      title: item.subject,
      detail: "Customer says they paid. Confirm the money before recording a receipt.",
      href: "/office/ledger",
    });
  }
  for (const document of input.documents) {
    if (document.kind !== "quote" || document.status !== "approved_unsent") continue;
    items.push({
      id: `quote:${document.id}`,
      title: document.title,
      detail: "Approved. Copy it and send it yourself.",
      href: "/office/sales",
    });
  }
  const invoiced = new Set(
    input.ledger
      .filter((row) => row.kind === "invoice" && row.relatedId)
      .map((row) => row.relatedId),
  );
  for (const opportunity of input.opportunities) {
    if (opportunity.stage !== "won" || invoiced.has(opportunity.id)) continue;
    items.push({
      id: `invoice:${opportunity.id}`,
      title: opportunity.companyName,
      detail: "Accepted. Raise the invoice from this figure.",
      href: "/office/ledger",
    });
  }
  for (const row of input.ledger) {
    if (row.kind !== "invoice" || row.status !== "issued") continue;
    items.push({
      id: `payment:${row.id}`,
      title: row.counterparty,
      detail: "Invoice is unsent until you copy it. Record payment only when it arrives.",
      href: "/office/ledger",
    });
  }
  for (const ticket of input.tickets) {
    if (ticket.status === "resolved") continue;
    const technical = ticket.ownerAgent === "forge" || ticket.ownerAgent === "keep";
    const service = ticket.ownerAgent === "desk";
    if (!technical && !service) continue;
    items.push({
      id: `ticket:${ticket.id}`,
      title: ticket.title,
      detail:
        ticket.status === "open"
          ? "Start the work. The customer is not emailed."
          : "Finish the work. The customer is not emailed.",
      href: service ? "/office/service" : "/office/technical",
    });
  }
  return items;
}
