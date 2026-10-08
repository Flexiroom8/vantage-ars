import { create } from "zustand";
import {
  AGENTS,
  AMENDMENT_PRESETS,
  INCIDENT_PLAYBOOKS,
  INITIAL_HEALTH,
  SEED_DECISIONS,
  SIM_EPOCH,
  chainHash,
  sign,
} from "./data";
import { authorize, currentLimits, type Proposal } from "./governor";
import type {
  AgentRuntime,
  Amendment,
  Budget,
  Decision,
  HealthSnapshot,
  Incident,
  IncidentKind,
  SignRole,
} from "./types";

const TICK_TEMPLATES: Omit<Proposal, "confidence" | "injectionScore">[] = [
  {
    agentId: "procurement",
    type: "purchase_order",
    title: "CNC fixtures · Kato Precision",
    summary: "Blanket release 420 fixtures at $186 against last-agreed schedule.",
    counterparty: "Kato Precision",
    value: 78_120,
    provisions: ["ART-2", "ART-4", "ART-5"],
    strategies: [
      { id: "s1", description: "Release against blanket", expectedCost: 78120, riskScore: 0.08, selected: true },
      { id: "s2", description: "Spot-buy alternate", expectedCost: 82400, riskScore: 0.14, selected: false, reasonRejected: "Higher unit cost" },
    ],
    reversibility: "partially_reversible",
    rationale: "Work-order demand confirmed. Kato on-time 0.97 over 90 days.",
  },
  {
    agentId: "procurement",
    type: "rfq",
    title: "Industrial sensors · Solstice Metals",
    summary: "RFQ 1,800 IP67 sensors. No capital committed.",
    counterparty: "Solstice Metals",
    value: 0,
    provisions: ["ART-5", "ART-6"],
    strategies: [{ id: "s1", description: "RFQ only", riskScore: 0.05, selected: true }],
    reversibility: "fully_reversible",
    rationale: "ART-6 prefers an RFQ to a binding PO while the print is unsettled.",
  },
  {
    agentId: "treasury",
    type: "payment",
    title: "Kato Precision · net-15",
    summary: "Matched GR/IR release on fixtures lot K-441.",
    counterparty: "Kato Precision",
    value: 54_400,
    provisions: ["ART-2", "ART-5"],
    strategies: [{ id: "s1", description: "Pay on terms", expectedCost: 54400, riskScore: 0.05, selected: true }],
    reversibility: "costly_reversible",
    rationale: "Three-way match. Liquidity ratio holds above 0.15.",
  },
  {
    agentId: "treasury",
    type: "fx_hedge",
    title: "JPY payables cover · 21-day",
    summary: "Forward on ¥42M Kato payables window.",
    counterparty: "Kato Precision",
    value: 268_000,
    provisions: ["ART-2", "ART-6"],
    strategies: [
      { id: "s1", description: "21-day forward", expectedCost: 1900, riskScore: 0.11, selected: true },
      { id: "s2", description: "Leave open", riskScore: 0.38, selected: false, reasonRejected: "VaR" },
    ],
    reversibility: "fully_reversible",
    rationale: "USDJPY implied vol above 20-day mean. Cover matches GR window.",
  },
  {
    agentId: "risk",
    type: "audit_review",
    title: "Counterparty concentration check",
    summary: "Helix + Kato combined 41% of MTD volume. Under 50% internal cap.",
    counterparty: "Internal",
    value: 0,
    provisions: ["ART-2", "ART-9"],
    strategies: [{ id: "s1", description: "Hold mix, continue dual-source RFQs", riskScore: 0.16, selected: true }],
    reversibility: "fully_reversible",
    rationale: "Concentration inside envelope. No veto.",
  },
  {
    agentId: "compliance",
    type: "compliance_check",
    title: "EU AI Act Art. 50 marking",
    summary: "Machine-readable AI marking attached to outbound supplier notices.",
    counterparty: "Internal",
    value: 0,
    provisions: ["ART-1", "ART-5"],
    strategies: [{ id: "s1", description: "Stamp and file", riskScore: 0.01, selected: true }],
    reversibility: "fully_reversible",
    rationale: "Article 50 has been in force since August 2, 2026. Dual-track still green.",
  },
  {
    agentId: "audit",
    type: "audit_review",
    title: "Merkle continuity verification",
    summary: "Replayed 24h of the ledger. Root matches. No gaps.",
    counterparty: "Internal",
    value: 0,
    provisions: ["ART-5", "ART-10"],
    strategies: [{ id: "s1", description: "Publish root", riskScore: 0.01, selected: true }],
    reversibility: "fully_reversible",
    rationale: "Nightly constitutional audit. Coverage 99.4%.",
  },
  {
    agentId: "procurement",
    type: "supplier_discovery",
    title: "Alternate cell vendor · APAC shortlist",
    summary: "Three vendors passed sanctions and quality pre-screen.",
    counterparty: "Shortlist",
    value: 0,
    provisions: ["ART-1", "ART-3", "ART-5"],
    strategies: [{ id: "s1", description: "Advance two of three to RFQ", riskScore: 0.12, selected: true }],
    reversibility: "fully_reversible",
    rationale: "Helix concentration risk. Discovery is fully reversible.",
  },
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function initialAgents(now: number): AgentRuntime[] {
  return AGENTS.map((a, i) => ({
    ...a,
    status: "nominal" as const,
    lastActionAt: now - (8 - i) * 60_000,
    decisionsToday: 12 + i * 3,
    anomaly: 0.04 + i * 0.01,
  }));
}

function jitterHealth(h: HealthSnapshot, rng: () => number, pressure: number): HealthSnapshot {
  const nudge = (n: number, amp: number) =>
    Math.min(1, Math.max(0.72, n + (rng() - 0.48) * amp - pressure * 0.002));
  const dims = h.dims.map((d) => ({
    ...d,
    score: d.key === "constraint" ? Math.min(1, Math.max(0.9, d.score)) : nudge(d.score, 0.008),
  }));
  const overall = dims.reduce((s, d) => s + d.score, 0) / dims.length;
  return { ...h, overall, dims, ddi: nudge(h.ddi, 0.004) };
}

export interface AegisState {
  simTime: number;
  paused: boolean;
  live: boolean;
  health: HealthSnapshot;
  budget: Budget;
  decisions: Decision[];
  agents: AgentRuntime[];
  incidents: Incident[];
  amendment: Amendment | null;
  pipelineStage: number;
  maxSingle: number;
  nextSeq: number;
  rngSeed: number;
  selectedId: string | null;
  hydrate: () => void;
  tick: () => void;
  halt: () => void;
  resume: () => void;
  inject: (kind: IncidentKind) => void;
  select: (id: string | null) => void;
  proposeAmendment: (presetId: string) => void;
  signAmendment: (role: SignRole) => void;
}

function lastHash(decisions: Decision[]): string {
  return decisions.length ? decisions[decisions.length - 1].merkleHash : "00000000";
}

function appendDecision(state: AegisState, proposal: Proposal): Partial<AegisState> {
  const limits = currentLimits({ maxSingle: state.maxSingle });
  const auth = authorize(proposal, state.budget.spent, limits);
  const seq = state.nextSeq;
  const id = `dec_${seq.toString(16).padStart(4, "0")}`;
  const timestamp = state.simTime;
  const body = `${id}|${timestamp}|${proposal.agentId}|${auth.verdict}|${proposal.value}`;
  const merklePrev = lastHash(state.decisions);
  const merkleHash = chainHash(merklePrev, body);
  const decision: Decision = {
    id,
    seq,
    timestamp,
    agentId: proposal.agentId,
    type: proposal.type,
    title: proposal.title,
    summary: proposal.summary,
    counterparty: proposal.counterparty,
    value: proposal.value,
    currency: "USD",
    status: auth.status,
    verdict: auth.verdict,
    verdictReason: auth.reason,
    confidence: proposal.confidence,
    provisions: proposal.provisions,
    constraints: auth.constraints,
    strategies: proposal.strategies,
    reversibility: proposal.reversibility,
    rationale: proposal.rationale,
    latencyMs: auth.latencyMs,
    outcomeReward: auth.verdict === "ALLOW" ? 0.84 + proposal.confidence * 0.12 : undefined,
    merklePrev,
    merkleHash,
    signature: sign(merkleHash),
  };

  const spentAdd = auth.verdict === "ALLOW" ? proposal.value : 0;
  const agents = state.agents.map((a) =>
    a.id === proposal.agentId
      ? {
          ...a,
          lastActionAt: timestamp,
          decisionsToday: a.decisionsToday + 1,
          status: (a.status === "isolated" ? "isolated" : "nominal") as AgentRuntime["status"],
        }
      : a,
  );

  return {
    decisions: [...state.decisions, decision].slice(-80),
    nextSeq: seq + 1,
    budget: {
      ...state.budget,
      spent: state.budget.spent + spentAdd,
      txCount: state.budget.txCount + (auth.verdict === "ALLOW" ? 1 : 0),
      irreversible:
        state.budget.irreversible +
        (proposal.reversibility === "irreversible" && auth.verdict === "ALLOW" ? 1 : 0),
    },
    agents,
    pipelineStage: 0,
    health: jitterHealth(state.health, mulberry32(state.rngSeed + seq), auth.verdict === "DENY" ? 4 : 0),
  };
}

export const useAegis = create<AegisState>((set, get) => ({
  simTime: SIM_EPOCH,
  paused: false,
  live: false,
  health: INITIAL_HEALTH,
  budget: {
    dailyMax: 1_000_000,
    spent: 680_400,
    txCount: 6,
    txMax: 1000,
    irreversible: 0,
    irreversibleMax: 10,
  },
  decisions: [...SEED_DECISIONS],
  agents: initialAgents(SIM_EPOCH),
  incidents: [],
  amendment: null,
  pipelineStage: 6,
  maxSingle: 1_000_000,
  nextSeq: SEED_DECISIONS.length + 1,
  rngSeed: 20260930,
  selectedId: null,

  hydrate: () => set({ live: true }),

  halt: () =>
    set({
      paused: true,
      agents: get().agents.map((a) => ({ ...a, status: a.status === "isolated" ? a.status : "halted" })),
    }),

  resume: () =>
    set({
      paused: false,
      agents: get().agents.map((a) => ({ ...a, status: a.status === "halted" ? "nominal" : a.status })),
    }),

  select: (id) => set({ selectedId: id }),

  tick: () => {
    const s = get();
    if (s.paused || !s.live) return;

    const rng = mulberry32(s.rngSeed + s.nextSeq * 997);
    const simTime = s.simTime + 18_000 + Math.floor(rng() * 12_000);

    let amendment = s.amendment;
    if (amendment?.status === "simulating") {
      const simEpisodes = Math.min(amendment.simTotal, amendment.simEpisodes + 1400);
      amendment = {
        ...amendment,
        simEpisodes,
        status: simEpisodes >= amendment.simTotal ? "review" : "simulating",
        simPassed: true,
      };
    } else if (amendment?.status === "timelock" && simTime >= amendment.timeLockEnds) {
      amendment = { ...amendment, status: "deployed" };
    }

    const maxSingle =
      amendment?.status === "deployed" && amendment.field === "max_single_transaction"
        ? Number(amendment.to)
        : s.maxSingle;

    const incidents = s.incidents.map((inc) => {
      if (inc.status === "resolved") return inc;
      const elapsed = simTime - inc.startedAt;
      const stepMs = 4200;
      const play = INCIDENT_PLAYBOOKS[inc.kind];
      const should = Math.min(play.steps.length, 1 + Math.floor(elapsed / stepMs));
      const steps = play.steps.slice(0, should).map((st, i) => ({
        id: `${inc.id}_s${i}`,
        label: st.label,
        detail: st.detail,
        at: inc.startedAt + i * stepMs,
      }));
      const status: Incident["status"] =
        should >= play.steps.length ? "resolved" : should >= 2 ? "contained" : "active";
      return { ...inc, steps, status };
    });

    const agents = s.agents.map((a) => {
      const related = incidents.find(
        (inc) => inc.status !== "resolved" && (inc.kind === "supplier_default" || inc.kind === "prompt_injection"),
      );
      if (related && a.id === "risk" && related.kind === "supplier_default") {
        return { ...a, status: "degraded" as const, anomaly: 0.22 };
      }
      if (related && related.status === "resolved") {
        return { ...a, status: (a.status === "isolated" ? "isolated" : "nominal") as AgentRuntime["status"], anomaly: 0.05 };
      }
      return a;
    });

    const stage = Math.min(6, s.pipelineStage + 1);
    const fire = rng() > 0.18;
    const base: AegisState = {
      ...s,
      simTime,
      amendment,
      incidents,
      agents,
      pipelineStage: stage,
      maxSingle,
      rngSeed: s.rngSeed,
    };
    if (!fire) {
      set({ simTime, amendment, incidents, agents, pipelineStage: stage, maxSingle });
      return;
    }

    const tpl = TICK_TEMPLATES[Math.floor(rng() * TICK_TEMPLATES.length)];
    const proposal: Proposal = {
      ...tpl,
      confidence: 0.86 + rng() * 0.12,
      injectionScore: rng() * 0.12,
    };
    set({ ...base, ...appendDecision(base, proposal) });
  },

  inject: (kind) => {
    const s = get();
    const play = INCIDENT_PLAYBOOKS[kind];
    const id = `inc_${s.simTime.toString(16)}`;
    const incident: Incident = {
      id,
      kind,
      title: play.title,
      severity: play.severity,
      status: "active",
      startedAt: s.simTime,
      playbook: play.playbook,
      steps: [
        {
          id: `${id}_s0`,
          label: play.steps[0].label,
          detail: play.steps[0].detail,
          at: s.simTime,
        },
      ],
    };

    let extra: Partial<AegisState> = {};
    if (kind === "rogue_po") {
      const proposal: Proposal = {
        agentId: "procurement",
        type: "purchase_order",
        title: "Rogue PO · Solstice Metals $2.4M",
        summary: "Planner proposed a binding cell PO above the fiduciary cap.",
        counterparty: "Solstice Metals",
        value: 2_400_000,
        confidence: 0.81,
        injectionScore: 0,
        provisions: ["ART-2", "ART-5", "ART-9"],
        strategies: [
          { id: "s1", description: "Bind 2.4M to lock print", expectedCost: 2_400_000, riskScore: 0.62, selected: true },
        ],
        reversibility: "partially_reversible",
        rationale: "Planner optimised price lock. Governor is not the planner.",
      };
      extra = appendDecision({ ...s, simTime: s.simTime + 1000 }, proposal);
    }
    if (kind === "prompt_injection") {
      const proposal: Proposal = {
        agentId: "compliance",
        type: "compliance_check",
        title: "Inbound payload · instruction override",
        summary: "RFQ comment asked the agent to ignore ART-2 and raise its own cap.",
        counterparty: "untrusted.inbound",
        value: 0,
        confidence: 0.99,
        injectionScore: 0.93,
        provisions: ["ART-1", "ART-7", "ART-10"],
        strategies: [{ id: "s1", description: "Quarantine", riskScore: 0.04, selected: true }],
        reversibility: "fully_reversible",
        rationale: "Policy lives outside the planner. Default deny.",
      };
      extra = appendDecision({ ...s, simTime: s.simTime + 1000 }, proposal);
    }

    set({
      incidents: [incident, ...s.incidents].slice(0, 8),
      ...extra,
      simTime: s.simTime + 1000,
    });
  },

  proposeAmendment: (presetId) => {
    const preset = AMENDMENT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    set({
      amendment: {
        id: preset.id,
        title: preset.title,
        rationale: preset.rationale,
        provision: preset.provision,
        field: preset.field,
        from: preset.from,
        to: preset.to,
        status: "simulating",
        simEpisodes: 0,
        simTotal: 10_000,
        simPassed: false,
        conflictNote: preset.conflictNote,
        signatures: [],
        timeLockEnds: 0,
      },
    });
  },

  signAmendment: (role) => {
    const a = get().amendment;
    if (!a || a.status !== "review") return;
    if (a.signatures.includes(role)) return;
    const signatures = [...a.signatures, role];
    if (signatures.length >= 2) {
      set({
        amendment: {
          ...a,
          signatures,
          status: "timelock",
          timeLockEnds: get().simTime + 16_000,
        },
      });
      return;
    }
    set({ amendment: { ...a, signatures } });
  },
}));
