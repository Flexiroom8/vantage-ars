export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export const ACTION_KINDS = [
  "route_inbound",
  "draft_reply",
  "create_lead",
  "update_lead",
  "draft_campaign",
  "activate_campaign",
  "handoff_to_sales",
  "open_opportunity",
  "advance_opportunity",
  "issue_quote",
  "propose_close_won",
  "propose_close_lost",
  "issue_invoice",
  "record_expense",
  "record_inbound_payment",
  "open_ticket",
  "update_ticket",
  "draft_document",
  "notify_operator",
  "escalate_account_risk",
] as const;

export type ActionKind = (typeof ACTION_KINDS)[number];

export type AgentStatus = "idle" | "working" | "blocked" | "halted";
export type AutonomyLevel = "A0" | "A1" | "A2" | "A3";
export type ApprovalKind =
  | "cost"
  | "sales_handoff"
  | "customer_win"
  | "customer_loss"
  | "constraint_margin";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type DecisionStatus = "authorized" | "executed" | "blocked" | "escalated";
export type Reversibility =
  | "fully_reversible"
  | "costly_reversible"
  | "partially_reversible"
  | "irreversible";

export type GovernorVerdict = "allow" | "review" | "deny";

export type ProvisionEnforcement =
  | "hard_block"
  | "soft_constraint"
  | "runtime"
  | "post_action"
  | "planning_heuristic"
  | "optimization_objective";

export type ProvisionCheck = {
  provision: string;
  check: string;
  passed: boolean;
  margin: number | null;
  detail: string;
};

export type ProposedAction = {
  kind: ActionKind;
  title: string;
  rationale: string;
  confidence: number;
  amountCents: number;
  companyName?: string;
  relatedId?: string;
  payload: { [key: string]: Json };
};

export type AuthorizationDecision = {
  verdict: GovernorVerdict;
  reason: string;
  approvalKind: ApprovalKind | null;
  reversibility: Reversibility;
  trace: ProvisionCheck[];
  runtimeConstraints: string[];
};

export type AgentDef = {
  id: string;
  callsign: string;
  title: string;
  department: string;
  spiffeId: string;
  autonomyLevel: AutonomyLevel;
  summary: string;
  allowedActions: ActionKind[];
  bindings: string[];
  authority: {
    maySpend: boolean;
    mayContactMarket: boolean;
    mayEnterSales: boolean;
    mayIssueInvoice: boolean;
    mayHaltFleet: boolean;
    vetoPower: boolean;
    maxAutonomousCents: number;
  };
};

export type CompanySnapshot = {
  id: string;
  legalName: string;
  tradingName: string;
  domain: string;
  jurisdiction: string;
  timezone: string;
  currency: string;
  vatRate: number;
  authorName: string;
  authorRole: string;
  constitutionVersion: string;
  treasuryCents: number;
  receivableCents: number;
  payableCents: number;
  autonomyLevel: AutonomyLevel;
  halted: boolean;
  haltReason: string | null;
  paymentInstructions: string;
  lastAuditHash: string;
  openedAt: string;
  updatedAt: string;
};

export type AgentRow = AgentDef & {
  status: AgentStatus;
  currentTask: string | null;
  lastHeartbeat: string | null;
  decisionsCount: number;
  escalationsCount: number;
};

export type InboundRow = {
  id: string;
  channel: string;
  companyName: string;
  subject: string;
  summary: string;
  intent: string;
  routedTo: string | null;
  status: string;
  createdAt: string;
};

export type LeadRow = {
  id: string;
  companyName: string;
  source: string;
  stage: string;
  score: number;
  summary: string;
  inboundId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OpportunityRow = {
  id: string;
  leadId: string;
  companyName: string;
  stage: string;
  valueCents: number;
  summary: string;
  handoffApprovalId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignRow = {
  id: string;
  name: string;
  channel: string;
  status: string;
  budgetCents: number;
  spendCents: number;
  summary: string;
  createdAt: string;
};

export type LedgerRow = {
  id: string;
  kind: string;
  counterparty: string;
  amountCents: number;
  vatCents: number;
  status: string;
  memo: string;
  relatedId: string | null;
  createdAt: string;
};

export type TicketRow = {
  id: string;
  title: string;
  severity: string;
  status: string;
  ownerAgent: string;
  summary: string;
  relatedId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentRow = {
  id: string;
  title: string;
  kind: string;
  status: string;
  summary: string;
  relatedId: string | null;
  createdAt: string;
};

export type ApprovalRow = {
  id: string;
  kind: ApprovalKind;
  title: string;
  rationale: string;
  amountCents: number;
  agentId: string;
  companyName: string | null;
  status: ApprovalStatus;
  riskScore: number;
  constitutionalTrace: ProvisionCheck[];
  action: ProposedAction;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type DecisionRow = {
  id: string;
  agentId: string;
  actionKind: string;
  title: string;
  rationale: string;
  status: DecisionStatus;
  confidence: number;
  reversibility: Reversibility;
  amountCents: number;
  constitutionalTrace: ProvisionCheck[];
  observation: { [key: string]: Json };
  action: { [key: string]: Json };
  evidenceHash: string;
  previousHash: string;
  recordHash: string;
  createdAt: string;
};

export type AuditRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  actor: string;
  previousHash: string;
  recordHash: string;
  createdAt: string;
};

export type ProvisionRow = {
  id: string;
  articleId: string;
  title: string;
  priority: number;
  body: string;
  enforcement: ProvisionEnforcement;
  machineCheckable: boolean;
  parameters: { [key: string]: Json };
};

export type AutonomyHealth = {
  overall: number;
  decisionQuality: number;
  constraintAdherence: number;
  selfHealing: number;
  governance: number;
  interventionRate: number;
  autonomousResolution: number;
  decisionCount: number;
  pendingApprovals: number;
  hardViolations: number;
  /** Approvals the founder has already decided, so the gate backlog has a history. */
  resolvedApprovals: number;
};

export type MailStatus = {
  smtpConnected: boolean;
  account: string | null;
};

export type OfficeSnapshot = {
  company: CompanySnapshot;
  provisions: ProvisionRow[];
  agents: AgentRow[];
  inbound: InboundRow[];
  leads: LeadRow[];
  opportunities: OpportunityRow[];
  campaigns: CampaignRow[];
  ledger: LedgerRow[];
  tickets: TicketRow[];
  documents: DocumentRow[];
  approvals: ApprovalRow[];
  decisions: DecisionRow[];
  audit: AuditRow[];
  notices: NoticeRow[];
  mail: MailStatus;
  health: AutonomyHealth;
};

export type NoticeRow = {
  id: string;
  kind: string;
  subject: string;
  status: "sent" | "not_delivered";
  detail: string;
  createdAt: string;
};

export type DispatchResult = {
  ok: boolean;
  briefing: string;
  error?: string;
  executed: number;
  escalated: number;
  blocked: number;
  decisionIds: string[];
  approvalIds: string[];
};
