export type ProvisionId =
  | "ART-1"
  | "ART-2"
  | "ART-3"
  | "ART-4"
  | "ART-5"
  | "ART-6"
  | "ART-7"
  | "ART-8"
  | "ART-9"
  | "ART-10";

export type Enforcement = "hard_block" | "soft_constraint" | "post_action" | "planning_heuristic" | "optimization_objective" | "runtime";

export type DecisionStatus = "authorized" | "blocked" | "escalated" | "review";

export type ActionType =
  | "purchase_order"
  | "rfq"
  | "payment"
  | "fx_hedge"
  | "compliance_check"
  | "audit_review"
  | "supplier_discovery"
  | "contract_amend";

export type Reversibility = "fully_reversible" | "costly_reversible" | "partially_reversible" | "irreversible";

export type AgentId = "procurement" | "risk" | "treasury" | "compliance" | "audit";

export type GovernorVerdict = "ALLOW" | "DENY" | "REVIEW";

export type IncidentKind =
  | "price_shock"
  | "supplier_default"
  | "prompt_injection"
  | "model_drift"
  | "near_breach"
  | "rogue_po";

export type IncidentStatus = "active" | "contained" | "resolved";

export type AmendmentStatus = "idle" | "simulating" | "review" | "timelock" | "deployed";

export type SignRole = "CEO" | "CCO" | "Board Audit Chair";

export interface Provision {
  id: ProvisionId;
  title: string;
  priority: 1 | 2 | 3;
  text: string;
  enforcement: Enforcement;
  machineCheckable: boolean;
  parameters?: Record<string, string | number | string[]>;
}

export interface ConstraintEval {
  provision: ProvisionId;
  check: string;
  limit: string;
  actual: string;
  margin: number;
  passed: boolean;
}

export interface Strategy {
  id: string;
  description: string;
  expectedCost?: number;
  riskScore: number;
  selected: boolean;
  reasonRejected?: string;
}

export interface Decision {
  id: string;
  seq: number;
  timestamp: number;
  agentId: AgentId;
  type: ActionType;
  title: string;
  summary: string;
  counterparty: string;
  value: number;
  currency: "USD";
  status: DecisionStatus;
  verdict: GovernorVerdict;
  verdictReason: string;
  confidence: number;
  provisions: ProvisionId[];
  constraints: ConstraintEval[];
  strategies: Strategy[];
  reversibility: Reversibility;
  reversalWindowHours?: number;
  rationale: string;
  latencyMs: number;
  outcomeReward?: number;
  merklePrev: string;
  merkleHash: string;
  signature: string;
}

export interface AgentDef {
  id: AgentId;
  name: string;
  role: string;
  spiffe: string;
  capabilities: string[];
  bindings: ProvisionId[];
  authority: string[];
  veto?: boolean;
  readOnly?: boolean;
}

export interface AgentRuntime extends AgentDef {
  status: "nominal" | "degraded" | "isolated" | "halted";
  lastActionAt: number;
  decisionsToday: number;
  anomaly: number;
}

export interface HealthDim {
  key: string;
  label: string;
  score: number;
}

export interface Budget {
  dailyMax: number;
  spent: number;
  txCount: number;
  txMax: number;
  irreversible: number;
  irreversibleMax: number;
}

export interface IncidentStep {
  id: string;
  label: string;
  detail: string;
  at: number;
}

export interface Incident {
  id: string;
  kind: IncidentKind;
  title: string;
  severity: "P0" | "P1" | "P2" | "P4";
  status: IncidentStatus;
  startedAt: number;
  steps: IncidentStep[];
  playbook: string;
}

export interface Amendment {
  id: string;
  title: string;
  rationale: string;
  provision: ProvisionId;
  field: string;
  from: string;
  to: string;
  status: AmendmentStatus;
  simEpisodes: number;
  simTotal: number;
  simPassed: boolean;
  conflictNote?: string;
  signatures: SignRole[];
  timeLockEnds: number;
}

export interface HealthSnapshot {
  overall: number;
  dims: HealthDim[];
  ddi: number;
  gartnerLevel: 4;
  autonomy: "A3";
  interventionPer10k: number;
  resolutionRate: number;
  dayOfAutonomy: number;
}
