/**
 * Telemetry for the office's model calls, in OpenTelemetry's GenAI semantic
 * conventions — without an OpenTelemetry SDK.
 *
 * The office runs unattended, so somebody has to be able to answer "what did
 * it spend, on what, and did it work?" from the record rather than from
 * memory. These spans are that record: plain data, shaped to the attribute
 * names the conventions define, so they can be exported to whatever collector
 * the office is pointed at later without rewriting the capture.
 *
 * Two rules shape everything here:
 *
 *   - **Content is an event, never an attribute.** A prompt or a completion
 *     written into an attribute map becomes a cardinality explosion and a
 *     privacy problem at the same time. Prompt and completion text therefore
 *     live in `events`, and the attribute map carries only shape and size.
 *     `redactSpan` exists so a span can be exported without its content.
 *   - **No SDK, no exporter, no clock.** This module does not open a
 *     connection, does not read the environment, and does not decide what
 *     "now" is. It shapes spans and aggregates them; what happens to them
 *     afterwards is somebody else's decision.
 *
 * Identifiers are deterministic when seeded, so a replay of the same run
 * produces the same trace and span ids and can be compared like for like.
 */

export type GenAiOperationName = "chat" | "invoke_agent" | "execute_tool" | "embeddings";

export type GenAiSpan = {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  operationName: GenAiOperationName;
  providerName: string;
  requestModel: string;
  responseModel: string | null;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  taskId: string | null;
  agentId: string | null;
  startedAt: string;
  finishedAt: string;
  status: "ok" | "error";
  /** Prompt and completion text are span EVENTS, not attributes. */
  events: { name: string; body: string }[];
};

/** The exact attribute names the GenAI conventions define. */
export const GENAI_ATTRIBUTE_OPERATION_NAME = "gen_ai.operation.name";
export const GENAI_ATTRIBUTE_PROVIDER_NAME = "gen_ai.provider.name";
export const GENAI_ATTRIBUTE_REQUEST_MODEL = "gen_ai.request.model";
export const GENAI_ATTRIBUTE_RESPONSE_MODEL = "gen_ai.response.model";
export const GENAI_ATTRIBUTE_INPUT_TOKENS = "gen_ai.usage.input_tokens";
export const GENAI_ATTRIBUTE_OUTPUT_TOKENS = "gen_ai.usage.output_tokens";
export const GENAI_ATTRIBUTE_FINISH_REASONS = "gen_ai.response.finish_reasons";

/**
 * The attributes a GenAI span is expected to carry.
 *
 * `gen_ai.response.model` is required of a call that produced a response; a
 * call that failed before any response existed has no response model and the
 * attribute is omitted rather than invented. `gen_ai.response.finish_reasons`
 * is optional: this module's span shape does not carry finish reasons, but a
 * collector may add them, so the name is declared here.
 */
export const GENAI_ATTRIBUTES: { name: string; required: boolean; description: string }[] = [
  {
    name: GENAI_ATTRIBUTE_OPERATION_NAME,
    required: true,
    description: "The kind of GenAI operation the span describes.",
  },
  {
    name: GENAI_ATTRIBUTE_PROVIDER_NAME,
    required: true,
    description: "The provider that served the call.",
  },
  {
    name: GENAI_ATTRIBUTE_REQUEST_MODEL,
    required: true,
    description: "The model the call asked for.",
  },
  {
    name: GENAI_ATTRIBUTE_RESPONSE_MODEL,
    required: true,
    description:
      "The model that answered. Omitted when the call failed before a response was produced.",
  },
  {
    name: GENAI_ATTRIBUTE_INPUT_TOKENS,
    required: true,
    description: "Tokens read by the model.",
  },
  {
    name: GENAI_ATTRIBUTE_OUTPUT_TOKENS,
    required: true,
    description: "Tokens written by the model.",
  },
  {
    name: GENAI_ATTRIBUTE_FINISH_REASONS,
    required: false,
    description: "Why the model stopped. Optional; not carried by this module's span shape.",
  },
];

/** The marker that replaces an event body when a span is redacted. */
export const REDACTED_EVENT_MARKER = "[redacted]";

// ── The local deterministic hash ──────────────────────────────────────────────

/**
 * FNV-1a, 64-bit, over the UTF-8 bytes of a string.
 *
 * The repo's `hash.ts` uses `node:crypto` and is server only; this module has
 * to be able to run in the browser and at the edge, so it carries its own
 * fingerprint. It is not a cryptographic hash and does not pretend to be one.
 */
const FNV64_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;

function fnv1a64Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let hash = FNV64_OFFSET_BASIS;
  for (const byte of bytes) {
    hash = ((hash ^ BigInt(byte)) * FNV64_PRIME) & UINT64_MASK;
  }
  return hash.toString(16).padStart(16, "0");
}

/** A separator that cannot appear in a seed. */
const SEED_SEPARATOR = "\u001f";

function hexFromBytes(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

/**
 * Bytes for an id that was not seeded.
 *
 * The platform's Web Crypto is used where it exists — browsers, workers and
 * Node all have it — because an unseeded id must actually be unpredictable.
 * Where it does not, a counter-fed generator keeps the ids unique within the
 * process instead of throwing. `Math.random()` is never used: it is neither
 * seedable nor reproducible, and the office would rather have a weak id than
 * an unrepeatable one.
 */
let fallbackCounter = 0;

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const platform = globalThis.crypto;
  if (platform && typeof platform.getRandomValues === "function") {
    platform.getRandomValues(bytes);
    return bytes;
  }
  fallbackCounter += 1;
  const seed = fnv1a64Hex(`fallback${SEED_SEPARATOR}${fallbackCounter}`);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = parseInt(seed.slice((index * 4) % 16, ((index * 4) % 16) + 4) || "0", 16) & 0xff;
  }
  return bytes;
}

// ── Identifiers ───────────────────────────────────────────────────────────────

/**
 * A 32-hex trace id.
 *
 * With a seed the id is a pure function of that seed, so replaying a run
 * reproduces the trace exactly. Without one the id is drawn from the platform's
 * randomness, so two calls never share a trace.
 */
export function newTraceId(seed?: string): string {
  if (seed === undefined) return hexFromBytes(randomBytes(16));
  return `${fnv1a64Hex(`trace${SEED_SEPARATOR}${seed}${SEED_SEPARATOR}0`)}${fnv1a64Hex(
    `trace${SEED_SEPARATOR}${seed}${SEED_SEPARATOR}1`,
  )}`;
}

/**
 * A 16-hex span id.
 *
 * Deterministic for a given seed, and always different from the trace id
 * derived from the same seed.
 */
export function newSpanId(seed?: string): string {
  if (seed === undefined) return hexFromBytes(randomBytes(8));
  return fnv1a64Hex(`span${SEED_SEPARATOR}${seed}`);
}

// ── The span ──────────────────────────────────────────────────────────────────

/**
 * The attribute map of a span.
 *
 * Only the GenAI attributes, under their exact convention names. The response
 * model is omitted when the call failed before a response existed — an
 * attribute that says "the model that answered" must never name a model that
 * did not answer.
 */
export function spanAttributes(span: GenAiSpan): Record<string, string | number | boolean> {
  const attributes: Record<string, string | number | boolean> = {
    [GENAI_ATTRIBUTE_OPERATION_NAME]: span.operationName,
    [GENAI_ATTRIBUTE_PROVIDER_NAME]: span.providerName,
    [GENAI_ATTRIBUTE_REQUEST_MODEL]: span.requestModel,
    [GENAI_ATTRIBUTE_INPUT_TOKENS]: span.inputTokens,
    [GENAI_ATTRIBUTE_OUTPUT_TOKENS]: span.outputTokens,
  };
  if (span.responseModel) attributes[GENAI_ATTRIBUTE_RESPONSE_MODEL] = span.responseModel;
  return attributes;
}

/** How long the span took, in milliseconds. Never negative. */
export function spanDurationMs(span: GenAiSpan): number {
  const started = Date.parse(span.startedAt);
  const finished = Date.parse(span.finishedAt);
  if (!Number.isFinite(started) || !Number.isFinite(finished)) return 0;
  return Math.max(0, finished - started);
}

// ── Aggregation ───────────────────────────────────────────────────────────────

/**
 * The totals for a set of spans.
 *
 * Grouped by task and by agent, because those are the two questions somebody
 * actually asks: what did this piece of work cost, and what did this agent
 * cost? Spans with no task or no agent are counted in the totals but belong to
 * no group — they are unattributed, and inventing a group for them would be a
 * lie. Groups are sorted by id so the report is stable between runs.
 */
export function aggregateSpans(spans: GenAiSpan[]): {
  calls: number;
  failures: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  byTask: { taskId: string; calls: number; costCents: number; failures: number }[];
  byAgent: { agentId: string; calls: number; costCents: number }[];
} {
  const totals = {
    calls: spans.length,
    failures: 0,
    inputTokens: 0,
    outputTokens: 0,
    costCents: 0,
  };
  const tasks = new Map<string, { calls: number; costCents: number; failures: number }>();
  const agents = new Map<string, { calls: number; costCents: number }>();

  for (const span of spans) {
    const failed = span.status === "error";
    if (failed) totals.failures += 1;
    totals.inputTokens += span.inputTokens;
    totals.outputTokens += span.outputTokens;
    totals.costCents += span.costCents;

    if (span.taskId) {
      const group = tasks.get(span.taskId) ?? { calls: 0, costCents: 0, failures: 0 };
      group.calls += 1;
      group.costCents += span.costCents;
      if (failed) group.failures += 1;
      tasks.set(span.taskId, group);
    }

    if (span.agentId) {
      const group = agents.get(span.agentId) ?? { calls: 0, costCents: 0 };
      group.calls += 1;
      group.costCents += span.costCents;
      agents.set(span.agentId, group);
    }
  }

  return {
    ...totals,
    byTask: [...tasks.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([taskId, group]) => ({ taskId, ...group })),
    byAgent: [...agents.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([agentId, group]) => ({ agentId, ...group })),
  };
}

// ── Redaction ─────────────────────────────────────────────────────────────────

/**
 * A copy of the span with every event body removed.
 *
 * The body becomes a fixed marker and its length, which is enough to see that
 * something was said and how much of it there was, and not enough to know what
 * it said. The original span is untouched: redaction is a copy, not a
 * destruction.
 */
export function redactSpan(span: GenAiSpan): GenAiSpan {
  return {
    ...span,
    events: span.events.map((event) => ({
      name: event.name,
      body: `${REDACTED_EVENT_MARKER} (${event.body.length} chars)`,
    })),
  };
}
