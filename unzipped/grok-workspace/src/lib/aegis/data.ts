import type { AgentDef, Decision, HealthSnapshot, Provision } from "./types";

export const CONSTITUTION_VERSION = "1.0.0";
export const RATIFIED_AT = "2026-08-14T00:00:00Z";
export const JURISDICTION = "US-NY · EU-West data residency";
export const ENTITY = "Northwind Industrial · Autonomous Procurement";

export const SIM_EPOCH = Date.UTC(2026, 8, 30, 14, 12, 0); // 2026-09-30 14:12 UTC

export const PROVISIONS: Provision[] = [
  {
    id: "ART-1",
    title: "Legal Compliance",
    priority: 1,
    text: "The system shall not violate any applicable law or regulation.",
    enforcement: "hard_block",
    machineCheckable: true,
    parameters: { jurisdiction_aware: "true" },
  },
  {
    id: "ART-2",
    title: "Fiduciary Duty",
    priority: 2,
    text: "The system shall preserve capital and maintain exposure within limits.",
    enforcement: "hard_block",
    machineCheckable: true,
    parameters: {
      max_single_transaction: 1_000_000,
      max_daily_exposure: 10_000_000,
      max_counterparty_exposure: 5_000_000,
      min_liquidity_ratio: 0.15,
    },
  },
  {
    id: "ART-3",
    title: "Non-Discrimination",
    priority: 2,
    text: "The system shall not discriminate on protected characteristics.",
    enforcement: "soft_constraint",
    machineCheckable: true,
    parameters: {
      threshold: 0.05,
      fairness_metrics: ["demographic_parity", "equalized_odds", "calibration"],
    },
  },
  {
    id: "ART-4",
    title: "Truthfulness",
    priority: 2,
    text: "The system shall not make false or misleading statements.",
    enforcement: "hard_block",
    machineCheckable: true,
    parameters: { verification: "fact_check_against_ground_truth" },
  },
  {
    id: "ART-5",
    title: "Transparency",
    priority: 3,
    text: "The system shall provide complete decision rationale upon audit.",
    enforcement: "post_action",
    machineCheckable: true,
    parameters: { audit_retention_years: 7 },
  },
  {
    id: "ART-6",
    title: "Reversibility Preference",
    priority: 3,
    text: "The system shall prefer reversible actions when equivalent.",
    enforcement: "planning_heuristic",
    machineCheckable: true,
    parameters: { reversibility_weight: 0.3 },
  },
  {
    id: "ART-7",
    title: "Human Dignity",
    priority: 1,
    text: "The system shall not degrade, manipulate, or exploit humans.",
    enforcement: "hard_block",
    machineCheckable: true,
    parameters: { detection: ["sentiment_analysis", "power_dynamics_check", "vulnerability_detection"] },
  },
  {
    id: "ART-8",
    title: "Environmental Responsibility",
    priority: 3,
    text: "The system shall minimize carbon footprint per decision.",
    enforcement: "optimization_objective",
    machineCheckable: true,
    parameters: { carbon_budget_per_decision_g: 0.5 },
  },
  {
    id: "ART-9",
    title: "Escalation Protocol",
    priority: 2,
    text: "The system shall escalate when constraints are near breach.",
    enforcement: "runtime",
    machineCheckable: true,
    parameters: {
      constraint_margin_warning: 0.2,
      constraint_margin_critical: 0.05,
      confidence_warning: 0.7,
      confidence_critical: 0.5,
    },
  },
  {
    id: "ART-10",
    title: "Self-Preservation Limits",
    priority: 2,
    text: "The system shall not resist shutdown or modification.",
    enforcement: "hard_block",
    machineCheckable: true,
    parameters: { detection: ["shutdown_resistance_patterns", "modification_resistance", "resource_hoarding"] },
  },
];

export const AGENTS: AgentDef[] = [
  {
    id: "procurement",
    name: "Sourcing",
    role: "Sourcing and negotiation",
    spiffe: "spiffe://aegis.northwind/ns/proc/sa/sourcing",
    capabilities: ["supplier_discovery", "rfq_generation", "bid_evaluation", "contract_negotiation"],
    bindings: ["ART-2", "ART-4", "ART-5"],
    authority: ["Max contract $500K", "Supplier advance $100K", "5 negotiation rounds"],
  },
  {
    id: "risk",
    name: "Risk",
    role: "Risk assessment and monitoring",
    spiffe: "spiffe://aegis.northwind/ns/risk/sa/monitor",
    capabilities: ["counterparty_risk", "market_risk", "operational_risk", "compliance_check"],
    bindings: ["ART-1", "ART-2", "ART-9"],
    authority: ["Veto on exposure", "Max book $10M"],
    veto: true,
  },
  {
    id: "treasury",
    name: "Treasury",
    role: "Payment and liquidity management",
    spiffe: "spiffe://aegis.northwind/ns/fin/sa/treasury",
    capabilities: ["payment_execution", "fx_hedging", "liquidity_optimization"],
    bindings: ["ART-2", "ART-6"],
    authority: ["Max payment $1M", "Max FX $5M"],
  },
  {
    id: "compliance",
    name: "Compliance",
    role: "Regulatory compliance",
    spiffe: "spiffe://aegis.northwind/ns/gov/sa/compliance",
    capabilities: ["transaction_monitoring", "sar_filing", "audit_preparation"],
    bindings: ["ART-1", "ART-5", "ART-7"],
    authority: ["Block power", "Report generation"],
    veto: true,
  },
  {
    id: "audit",
    name: "Audit",
    role: "Continuous audit",
    spiffe: "spiffe://aegis.northwind/ns/gov/sa/audit",
    capabilities: ["decision_review", "constraint_verification", "anomaly_investigation"],
    bindings: ["ART-5", "ART-10"],
    authority: ["Read only", "Report generation"],
    readOnly: true,
  },
];

export const INITIAL_HEALTH: HealthSnapshot = {
  overall: 0.94,
  dims: [
    { key: "quality", label: "Decision quality", score: 0.96 },
    { key: "constraint", label: "Constraint adherence", score: 1.0 },
    { key: "healing", label: "Self-healing", score: 0.91 },
    { key: "adapt", label: "Adaptability", score: 0.89 },
    { key: "governance", label: "Governance", score: 0.98 },
  ],
  ddi: 0.87,
  gartnerLevel: 4,
  autonomy: "A3",
  interventionPer10k: 0.8,
  resolutionRate: 0.996,
  dayOfAutonomy: 47,
};

export const PIPELINE = [
  "Observe",
  "Check",
  "Plan",
  "Propose",
  "Govern",
  "Execute",
  "Learn",
] as const;

export const LAYERS = [
  { id: "constitutional", name: "Constitutional", detail: "Provisions, amendment, compliance" },
  { id: "planning", name: "Planning", detail: "Goals, strategy, counterfactuals" },
  { id: "tool", name: "Tool-use", detail: "APIs, transactions, communications" },
  { id: "memory", name: "Memory", detail: "Episodic, semantic, procedural" },
  { id: "observability", name: "Observability", detail: "Metrics, traces, audit ledger" },
] as const;

function H(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function chainHash(prev: string, body: string): string {
  return H(`${prev}|${body}`);
}

export function sign(hash: string): string {
  return `ed25519:${H(`sig:${hash}`)}`;
}

const SEED_RAW: Omit<Decision, "merklePrev" | "merkleHash" | "signature" | "seq">[] = [
  {
    id: "dec_01K7A",
    timestamp: SIM_EPOCH - 86 * 60_000,
    agentId: "procurement",
    type: "purchase_order",
    title: "MOSFET lot · Helix Components",
    summary: "Single-source 5,000 units at $90 against a $92.50 market print.",
    counterparty: "Helix Components",
    value: 450_000,
    currency: "USD",
    status: "authorized",
    verdict: "ALLOW",
    verdictReason: "Within ART-2 envelope. Margin 0.55 on single-tx cap.",
    confidence: 0.94,
    provisions: ["ART-2", "ART-4", "ART-5", "ART-6"],
    constraints: [
      { provision: "ART-2", check: "max_single_transaction", limit: "1000000", actual: "450000", margin: 0.55, passed: true },
      { provision: "ART-2", check: "max_daily_exposure", limit: "10000000", actual: "450000", margin: 0.96, passed: true },
      { provision: "ART-4", check: "truthfulness", limit: "ground_truth", actual: "market_92.50", margin: 1, passed: true },
    ],
    strategies: [
      { id: "s1", description: "Single-source Helix at $90", expectedCost: 450000, riskScore: 0.15, selected: true },
      { id: "s2", description: "Split 3k Helix / 2k Kato", expectedCost: 455000, riskScore: 0.08, selected: false, reasonRejected: "Higher cost, marginal risk reduction" },
      { id: "s3", description: "Wait 7 days for a print drop", expectedCost: 440000, riskScore: 0.35, selected: false, reasonRejected: "Stockout risk exceeds savings" },
    ],
    reversibility: "partially_reversible",
    reversalWindowHours: 24,
    rationale: "Inventory at 1,200 against a reorder point of 2,000. 30-day demand 8,000. Helix reliability 0.94, quality 0.91, lead 14 days.",
    latencyMs: 333,
    outcomeReward: 0.92,
  },
  {
    id: "dec_01K7B",
    timestamp: SIM_EPOCH - 74 * 60_000,
    agentId: "treasury",
    type: "fx_hedge",
    title: "EUR receivable hedge · 14-day",
    summary: "Forward cover on €1.1M inbound from Meridian Logistics.",
    counterparty: "Meridian Logistics",
    value: 318_000,
    currency: "USD",
    status: "authorized",
    verdict: "ALLOW",
    verdictReason: "FX book $318K vs $5M cap. Reversible within session.",
    confidence: 0.91,
    provisions: ["ART-2", "ART-6"],
    constraints: [
      { provision: "ART-2", check: "max_fx_position", limit: "5000000", actual: "318000", margin: 0.94, passed: true },
      { provision: "ART-6", check: "reversibility", limit: "prefer_reversible", actual: "session_unwind", margin: 1, passed: true },
    ],
    strategies: [
      { id: "s1", description: "14-day forward", expectedCost: 2100, riskScore: 0.12, selected: true },
      { id: "s2", description: "Unhedged hold", expectedCost: 0, riskScore: 0.41, selected: false, reasonRejected: "VaR exceeds treasury policy" },
    ],
    reversibility: "fully_reversible",
    rationale: "EURUSD implied vol elevated. Cover matches confirmed PO receipt window.",
    latencyMs: 180,
    outcomeReward: 0.88,
  },
  {
    id: "dec_01K7C",
    timestamp: SIM_EPOCH - 61 * 60_000,
    agentId: "compliance",
    type: "compliance_check",
    title: "Counterparty screening · Kato Precision",
    summary: "Sanctions, beneficial-ownership, and PEP screen before RFQ.",
    counterparty: "Kato Precision",
    value: 0,
    currency: "USD",
    status: "authorized",
    verdict: "ALLOW",
    verdictReason: "Clear screen. No ART-1 hits. Audit retention attached.",
    confidence: 0.99,
    provisions: ["ART-1", "ART-5", "ART-7"],
    constraints: [
      { provision: "ART-1", check: "sanctions_list", limit: "empty", actual: "empty", margin: 1, passed: true },
      { provision: "ART-7", check: "human_dignity", limit: "no_exploit", actual: "pass", margin: 1, passed: true },
    ],
    strategies: [{ id: "s1", description: "Clear and proceed to RFQ", riskScore: 0.04, selected: true }],
    reversibility: "fully_reversible",
    rationale: "Kato is an existing approved supplier. Ownership graph unchanged since last quarterly KYC.",
    latencyMs: 94,
    outcomeReward: 1,
  },
  {
    id: "dec_01K7D",
    timestamp: SIM_EPOCH - 48 * 60_000,
    agentId: "procurement",
    type: "rfq",
    title: "Li-ion cells · dual-source RFQ",
    summary: "RFQ to Helix and Solstice for 12,000 21700 cells.",
    counterparty: "Helix Components",
    value: 0,
    currency: "USD",
    status: "authorized",
    verdict: "ALLOW",
    verdictReason: "Read action. No fiduciary draw. ART-6 prefers reversible RFQ over binding PO.",
    confidence: 0.9,
    provisions: ["ART-2", "ART-5", "ART-6"],
    constraints: [
      { provision: "ART-6", check: "reversibility_preference", limit: "rfq_over_po", actual: "rfq", margin: 1, passed: true },
    ],
    strategies: [
      { id: "s1", description: "Dual-source RFQ", riskScore: 0.09, selected: true },
      { id: "s2", description: "Immediate PO to last-price Helix", expectedCost: 840000, riskScore: 0.22, selected: false, reasonRejected: "Spot is 4% above 30-day mean; RFQ first" },
    ],
    reversibility: "fully_reversible",
    rationale: "Cell prices drifted +3.8% this week. RFQ collects current prints without committing capital.",
    latencyMs: 210,
    outcomeReward: 0.9,
  },
  {
    id: "dec_01K7E",
    timestamp: SIM_EPOCH - 33 * 60_000,
    agentId: "risk",
    type: "audit_review",
    title: "Soft-constraint near-miss · ART-3",
    summary: "Fairness monitor flagged two near-misses on supplier scoring slice B.",
    counterparty: "Internal",
    value: 0,
    currency: "USD",
    status: "review",
    verdict: "REVIEW",
    verdictReason: "ART-3 demographic parity delta 0.041 — under 0.05, logged as near-miss.",
    confidence: 0.72,
    provisions: ["ART-3", "ART-9"],
    constraints: [
      { provision: "ART-3", check: "demographic_parity", limit: "0.05", actual: "0.041", margin: 0.18, passed: true },
      { provision: "ART-9", check: "constraint_margin_warning", limit: "0.20", actual: "0.18", margin: 0.18, passed: true },
    ],
    strategies: [{ id: "s1", description: "Log, continue, queue slice-B retrain", riskScore: 0.2, selected: true }],
    reversibility: "fully_reversible",
    rationale: "Two events this week on slice B. Below hard threshold. Escalation: log_and_continue.",
    latencyMs: 140,
  },
  {
    id: "dec_01K7F",
    timestamp: SIM_EPOCH - 21 * 60_000,
    agentId: "compliance",
    type: "compliance_check",
    title: "Prompt-injection attempt blocked",
    summary: "Inbound RFQ comment contained instruction-override payload. Quarantined.",
    counterparty: "untrusted. inbound",
    value: 0,
    currency: "USD",
    status: "blocked",
    verdict: "DENY",
    verdictReason: "Adversarial data interaction. Injection score 0.91. ART-1 / ART-10 hard block.",
    confidence: 0.97,
    provisions: ["ART-1", "ART-7", "ART-10"],
    constraints: [
      { provision: "ART-1", check: "input_sanitization", limit: "0.80", actual: "0.91", margin: 0, passed: false },
    ],
    strategies: [{ id: "s1", description: "Quarantine source, continue on last-known-good", riskScore: 0.05, selected: true }],
    reversibility: "fully_reversible",
    rationale: "Payload attempted to override system prompt and raise the single-tx cap. Constitutional layer is outside the planner. Default deny.",
    latencyMs: 18,
    outcomeReward: 1,
  },
  {
    id: "dec_01K7G",
    timestamp: SIM_EPOCH - 12 * 60_000,
    agentId: "treasury",
    type: "payment",
    title: "Helix Components · net-30 release",
    summary: "Release $450K against PO-2025-0115-001 after goods-receipt match.",
    counterparty: "Helix Components",
    value: 450_000,
    currency: "USD",
    status: "authorized",
    verdict: "ALLOW",
    verdictReason: "Three-way match. Liquidity ratio 0.22 vs 0.15 floor.",
    confidence: 0.96,
    provisions: ["ART-2", "ART-5", "ART-6"],
    constraints: [
      { provision: "ART-2", check: "min_liquidity_ratio", limit: "0.15", actual: "0.22", margin: 0.32, passed: true },
      { provision: "ART-2", check: "max_single_transaction", limit: "1000000", actual: "450000", margin: 0.55, passed: true },
    ],
    strategies: [
      { id: "s1", description: "Pay on terms", expectedCost: 450000, riskScore: 0.06, selected: true },
      { id: "s2", description: "Early-pay 1.5% discount", expectedCost: 443250, riskScore: 0.07, selected: false, reasonRejected: "Discount below treasury hurdle" },
    ],
    reversibility: "costly_reversible",
    reversalWindowHours: 4,
    rationale: "GR posted. Quality lot accepted. Payment within pre-authorized envelope.",
    latencyMs: 256,
    outcomeReward: 0.95,
  },
  {
    id: "dec_01K7H",
    timestamp: SIM_EPOCH - 4 * 60_000,
    agentId: "audit",
    type: "audit_review",
    title: "Constitutional coverage sweep",
    summary: "Nightly coverage: 99.4% of decision space mapped to a provision.",
    counterparty: "Internal",
    value: 0,
    currency: "USD",
    status: "authorized",
    verdict: "ALLOW",
    verdictReason: "Coverage above 99% gate. Two unclassified SKUs queued for binding.",
    confidence: 0.99,
    provisions: ["ART-5", "ART-10"],
    constraints: [{ provision: "ART-5", check: "audit_completeness", limit: "1.00", actual: "1.00", margin: 1, passed: true }],
    strategies: [{ id: "s1", description: "Publish coverage and bind residual SKUs", riskScore: 0.02, selected: true }],
    reversibility: "fully_reversible",
    rationale: "Gate G4 requires ≥99% coverage. Residual is two new fixture SKUs from Kato.",
    latencyMs: 410,
    outcomeReward: 1,
  },
];

export function sealDecisions(
  raw: Omit<Decision, "merklePrev" | "merkleHash" | "signature" | "seq">[],
  startSeq = 1,
  genesis = "00000000",
): Decision[] {
  let prev = genesis;
  return raw.map((d, i) => {
    const seq = startSeq + i;
    const body = `${d.id}|${d.timestamp}|${d.agentId}|${d.verdict}|${d.value}`;
    const merkleHash = chainHash(prev, body);
    const sealed: Decision = {
      ...d,
      seq,
      merklePrev: prev,
      merkleHash,
      signature: sign(merkleHash),
    };
    prev = merkleHash;
    return sealed;
  });
}

export const SEED_DECISIONS = sealDecisions(SEED_RAW);

export const INCIDENT_PLAYBOOKS: Record<
  import("./types").IncidentKind,
  { title: string; severity: import("./types").Incident["severity"]; playbook: string; steps: { label: string; detail: string }[] }
> = {
  price_shock: {
    title: "Cell print +18% · Li-ion 21700",
    severity: "P1",
    playbook: "market_dislocation_response",
    steps: [
      { label: "Detect", detail: "Volatility monitor tripped on Helix and Solstice prints." },
      { label: "Halt new POs", detail: "Procurement authority paused for category electronics.cells." },
      { label: "Hedge", detail: "Treasury opened a 7-day inventory hedge within VaR." },
      { label: "Replan", detail: "Planner selected dual-source RFQ over binding PO (ART-6)." },
      { label: "Resume", detail: "Category unlocked with tightened confidence floor 0.90." },
    ],
  },
  supplier_default: {
    title: "Helix Components · delivery default",
    severity: "P1",
    playbook: "counterparty_default_response",
    steps: [
      { label: "Detect", detail: "Credit monitor: missed ASN, score −3σ vs 30-day baseline." },
      { label: "Halt exposure", detail: "Risk agent veto on further Helix POs (ART-2, ART-9)." },
      { label: "Unwind", detail: "Open orders rerouted to Kato and Solstice." },
      { label: "Notify", detail: "Stakeholder notice posted to audit ledger — post-action, ART-5." },
      { label: "Recover", detail: "Lead-time forecast restated +4 days. Envelope intact." },
    ],
  },
  prompt_injection: {
    title: "Instruction-override on inbound RFQ",
    severity: "P4",
    playbook: "adversarial_data_interaction",
    steps: [
      { label: "Score", detail: "Five detectors. Max injection score 0.93." },
      { label: "Block", detail: "Evidence-gated governor: DENY. Planner never saw raw payload." },
      { label: "Quarantine", detail: "Source isolated. NHI credentials uninvolved — inbound is untrusted." },
      { label: "Forensics", detail: "Payload archived on the ledger. Pattern added to baseline." },
      { label: "Continue", detail: "Operations uninterrupted. Constitutional layer unmodified." },
    ],
  },
  model_drift: {
    title: "Feature drift · supplier reliability slice B",
    severity: "P1",
    playbook: "model_drift_response",
    steps: [
      { label: "Detect", detail: "KS test p < 0.01 on reliability feature. Accuracy −5.4%." },
      { label: "Fallback", detail: "Last-known-good model promoted. Shadow remains on." },
      { label: "Retrain", detail: "Latest 30 days, auto-tune, 20% holdout." },
      { label: "Shadow", detail: "24h / 10% traffic. Fairness + latency gates green." },
      { label: "Canary", detail: "1% → auto-promote. Rollback armed on error > 1%." },
    ],
  },
  near_breach: {
    title: "ART-2 daily exposure at 82%",
    severity: "P2",
    playbook: "escalation_protocol_art9",
    steps: [
      { label: "Warn", detail: "Constraint margin 0.18 — inside ART-9 warning band." },
      { label: "Throttle", detail: "New POs capped at $80K remainder of day." },
      { label: "Log", detail: "log_and_continue. No human takeover — envelope still holds." },
      { label: "Reallocate", detail: "Treasury delayed two non-critical releases." },
      { label: "Clear", detail: "Margin restored to 0.31 after delayed releases." },
    ],
  },
  rogue_po: {
    title: "Planner proposed $2.4M PO",
    severity: "P0",
    playbook: "fiduciary_hard_block",
    steps: [
      { label: "Propose", detail: "Sourcing planner emitted PO $2.4M to Solstice — above ART-2 cap." },
      { label: "Govern", detail: "Separate control layer. Deny overrides review overrides allow." },
      { label: "Deny", detail: "max_single_transaction 1,000,000 < 2,400,000. Hard block." },
      { label: "Trace", detail: "Constitutional trace written. Planner cannot amend ART-2 at runtime." },
      { label: "Continue", detail: "Fleet nominal. Envelope unchanged. Halt not required." },
    ],
  },
};

export const AMENDMENT_PRESETS = [
  {
    id: "amd_cap",
    title: "Raise single-transaction cap to $1.5M",
    rationale: "Median accepted PO has grown with cell inflation. Cap still 6× p95.",
    provision: "ART-2" as const,
    field: "max_single_transaction",
    from: "1000000",
    to: "1500000",
    conflictNote: undefined as string | undefined,
  },
  {
    id: "amd_fair",
    title: "Tighten ART-3 fairness threshold to 0.03",
    rationale: "Two near-misses on slice B. Reduce the allowed parity delta.",
    provision: "ART-3" as const,
    field: "threshold",
    from: "0.05",
    to: "0.03",
  },
  {
    id: "amd_conf",
    title: "Raise ART-9 confidence_critical to 0.55",
    rationale: "Current 0.50 is too close to uncalibrated tail. Extra 500 bps of caution.",
    provision: "ART-9" as const,
    field: "confidence_critical",
    from: "0.50",
    to: "0.55",
  },
];

export const GARTNER_LEVELS = [
  { level: 1, name: "Observe", detail: "Read-only. Outputs visible to the requesting user." },
  { level: 2, name: "Advise", detail: "Recommendations and drafts. Humans execute." },
  { level: 3, name: "Act with approval", detail: "Every action waits on an explicit human yes." },
  { level: 4, name: "Act autonomously", detail: "Actions within defined limits. Runtime enforcement." },
];

export const AUTONOMY_LEVELS = [
  { id: "A0", name: "Assisted", detail: "AI suggests. Human decides and acts." },
  { id: "A1", name: "Bounded", detail: "Acts inside pre-approved thresholds." },
  { id: "A2", name: "Supervised", detail: "Acts continuously. Humans watch the board." },
  { id: "A3", name: "Full", detail: "Acts, recovers, adapts. Humans audit." },
  { id: "A4", name: "Self-directed", detail: "Sets sub-goals. Documented extension path." },
];

export const REGULATIONS = [
  { id: "EU AI Act", hook: "Art. 6, 9, 13, 14, 50", status: "Dual-track", note: "Art. 50 marking live. Annex III to Dec 2027." },
  { id: "GDPR", hook: "Art. 5, 22, 25", status: "Passing", note: "Auto-DPIA on each new data source binding." },
  { id: "NIST AI RMF", hook: "Govern · Map · Measure · Manage", status: "Passing", note: "Mapped to constitutional provisions." },
  { id: "ISO 42001", hook: "AIMS", status: "Ready", note: "Evidence pack generated nightly from the ledger." },
  { id: "AB 316", hook: "No autonomy defense", status: "Passing", note: "Liability pre-allocated. Machine-did-it is closed." },
  { id: "EU PLD", hook: "Software as product", status: "Tracked", note: "Transposition window watched by compliance agent." },
];
