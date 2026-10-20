import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GENAI_ATTRIBUTES,
  GENAI_ATTRIBUTE_FINISH_REASONS,
  GENAI_ATTRIBUTE_INPUT_TOKENS,
  GENAI_ATTRIBUTE_OPERATION_NAME,
  GENAI_ATTRIBUTE_OUTPUT_TOKENS,
  GENAI_ATTRIBUTE_PROVIDER_NAME,
  GENAI_ATTRIBUTE_REQUEST_MODEL,
  GENAI_ATTRIBUTE_RESPONSE_MODEL,
  REDACTED_EVENT_MARKER,
  aggregateSpans,
  newSpanId,
  newTraceId,
  redactSpan,
  spanAttributes,
  spanDurationMs,
  type GenAiSpan,
} from "./telemetry.ts";

const PROMPT = "Draft a reply to the customer who asked about a VoIP quote.";

function span(overrides: Partial<GenAiSpan> = {}): GenAiSpan {
  return {
    traceId: newTraceId("seed"),
    spanId: newSpanId("seed"),
    parentSpanId: null,
    name: "chat desk",
    operationName: "chat",
    providerName: "openai-compatible",
    requestModel: "reasoning-model",
    responseModel: "reasoning-model",
    inputTokens: 1200,
    outputTokens: 300,
    costCents: 42,
    taskId: "task-1",
    agentId: "desk",
    startedAt: "2026-03-14T09:00:00.000Z",
    finishedAt: "2026-03-14T09:00:02.500Z",
    status: "ok",
    events: [
      { name: "gen_ai.content.prompt", body: PROMPT },
      { name: "gen_ai.content.completion", body: "Here is the reply you asked for." },
    ],
    ...overrides,
  };
}

describe("the GenAI attribute names", () => {
  it("are exactly the names the conventions define", () => {
    assert.deepEqual(
      GENAI_ATTRIBUTES.map((attribute) => attribute.name),
      [
        "gen_ai.operation.name",
        "gen_ai.provider.name",
        "gen_ai.request.model",
        "gen_ai.response.model",
        "gen_ai.usage.input_tokens",
        "gen_ai.usage.output_tokens",
        "gen_ai.response.finish_reasons",
      ],
    );
  });

  it("mark the required attributes and the optional one", () => {
    const required = GENAI_ATTRIBUTES.filter((attribute) => attribute.required).map((a) => a.name);
    assert.deepEqual(required, [
      "gen_ai.operation.name",
      "gen_ai.provider.name",
      "gen_ai.request.model",
      "gen_ai.response.model",
      "gen_ai.usage.input_tokens",
      "gen_ai.usage.output_tokens",
    ]);
    const optional = GENAI_ATTRIBUTES.filter((attribute) => !attribute.required);
    assert.equal(optional.length, 1);
    assert.equal(optional[0].name, GENAI_ATTRIBUTE_FINISH_REASONS);
  });

  it("describe every attribute", () => {
    for (const attribute of GENAI_ATTRIBUTES) {
      assert.ok(attribute.description.length > 0, `${attribute.name} has no description`);
    }
  });
});

describe("the attribute map", () => {
  it("uses the convention names", () => {
    const attributes = spanAttributes(span());
    assert.deepEqual(
      Object.keys(attributes).sort(),
      [
        GENAI_ATTRIBUTE_INPUT_TOKENS,
        GENAI_ATTRIBUTE_OPERATION_NAME,
        GENAI_ATTRIBUTE_OUTPUT_TOKENS,
        GENAI_ATTRIBUTE_PROVIDER_NAME,
        GENAI_ATTRIBUTE_REQUEST_MODEL,
        GENAI_ATTRIBUTE_RESPONSE_MODEL,
      ].sort(),
    );
    assert.equal(attributes[GENAI_ATTRIBUTE_OPERATION_NAME], "chat");
    assert.equal(attributes[GENAI_ATTRIBUTE_PROVIDER_NAME], "openai-compatible");
    assert.equal(attributes[GENAI_ATTRIBUTE_REQUEST_MODEL], "reasoning-model");
    assert.equal(attributes[GENAI_ATTRIBUTE_RESPONSE_MODEL], "reasoning-model");
    assert.equal(attributes[GENAI_ATTRIBUTE_INPUT_TOKENS], 1200);
    assert.equal(attributes[GENAI_ATTRIBUTE_OUTPUT_TOKENS], 300);
  });

  it("omits the response model when the call failed before a response", () => {
    const attributes = spanAttributes(
      span({ status: "error", responseModel: null, outputTokens: 0 }),
    );
    assert.equal(GENAI_ATTRIBUTE_RESPONSE_MODEL in attributes, false);
    assert.equal(attributes[GENAI_ATTRIBUTE_REQUEST_MODEL], "reasoning-model");
  });

  it("never carries the prompt or the completion", () => {
    const attributes = spanAttributes(span());
    const rendered = JSON.stringify(attributes);
    assert.equal(rendered.includes(PROMPT), false);
    assert.equal(rendered.includes("Here is the reply"), false);
    assert.equal(rendered.toLowerCase().includes("prompt"), false);
  });
});

describe("identifiers", () => {
  it("are 32 hex for a trace and 16 hex for a span", () => {
    assert.match(newTraceId("seed"), /^[0-9a-f]{32}$/);
    assert.match(newSpanId("seed"), /^[0-9a-f]{16}$/);
  });

  it("are the same for the same seed", () => {
    assert.equal(newTraceId("seed"), newTraceId("seed"));
    assert.equal(newSpanId("seed"), newSpanId("seed"));
  });

  it("are different for different seeds", () => {
    assert.notEqual(newTraceId("seed-a"), newTraceId("seed-b"));
    assert.notEqual(newSpanId("seed-a"), newSpanId("seed-b"));
  });

  it("never confuse a trace with a span", () => {
    assert.notEqual(newTraceId("seed").slice(0, 16), newSpanId("seed"));
  });

  it("are unguessable when no seed is given", () => {
    const ids = new Set<string>();
    for (let index = 0; index < 200; index += 1) ids.add(newTraceId());
    assert.equal(ids.size, 200, "unseeded trace ids repeated");
    for (const id of ids) assert.match(id, /^[0-9a-f]{32}$/);
  });
});

describe("the span's duration", () => {
  it("is the time between the start and the finish", () => {
    assert.equal(spanDurationMs(span()), 2500);
  });

  it("is never negative", () => {
    assert.equal(
      spanDurationMs(
        span({ startedAt: "2026-03-14T09:00:05.000Z", finishedAt: "2026-03-14T09:00:00.000Z" }),
      ),
      0,
    );
  });
});

describe("redaction", () => {
  it("replaces every event body with a marker and a length", () => {
    const redacted = redactSpan(span());
    for (const event of redacted.events) {
      assert.equal(event.body.startsWith(REDACTED_EVENT_MARKER), true);
      assert.match(event.body, /\d+ chars\)$/);
    }
  });

  it("removes the prompt and the completion entirely", () => {
    const redacted = redactSpan(span());
    const rendered = JSON.stringify(redacted);
    assert.equal(rendered.includes(PROMPT), false);
    assert.equal(rendered.includes("Here is the reply"), false);
  });

  it("keeps the shape of the span", () => {
    const redacted = redactSpan(span());
    assert.equal(redacted.traceId, span().traceId);
    assert.equal(redacted.taskId, "task-1");
    assert.equal(redacted.costCents, 42);
    assert.equal(redacted.events.length, 2);
  });

  it("does not touch the span it was given", () => {
    const original = span();
    redactSpan(original);
    assert.equal(original.events[0].body, PROMPT);
  });
});

describe("aggregating spans", () => {
  const spans = [
    span({ taskId: "task-1", agentId: "desk", costCents: 100, inputTokens: 10, outputTokens: 5 }),
    span({ taskId: "task-1", agentId: "desk", costCents: 50, inputTokens: 20, outputTokens: 5 }),
    span({
      taskId: "task-2",
      agentId: "foyer",
      costCents: 25,
      inputTokens: 1,
      outputTokens: 1,
      status: "error",
    }),
    span({ taskId: null, agentId: null, costCents: 5, inputTokens: 1, outputTokens: 1 }),
  ];

  it("totals the calls, the tokens and the cost", () => {
    const totals = aggregateSpans(spans);
    assert.equal(totals.calls, 4);
    assert.equal(totals.failures, 1);
    assert.equal(totals.inputTokens, 32);
    assert.equal(totals.outputTokens, 12);
    assert.equal(totals.costCents, 180);
  });

  it("groups by task", () => {
    const totals = aggregateSpans(spans);
    assert.deepEqual(totals.byTask, [
      { taskId: "task-1", calls: 2, costCents: 150, failures: 0 },
      { taskId: "task-2", calls: 1, costCents: 25, failures: 1 },
    ]);
  });

  it("groups by agent", () => {
    const totals = aggregateSpans(spans);
    assert.deepEqual(totals.byAgent, [
      { agentId: "desk", calls: 2, costCents: 150 },
      { agentId: "foyer", calls: 1, costCents: 25 },
    ]);
  });

  it("leaves an unattributed call out of the groups but not out of the totals", () => {
    const totals = aggregateSpans(spans);
    const grouped = totals.byTask.reduce((sum, group) => sum + group.calls, 0);
    assert.equal(grouped, 3);
    assert.equal(totals.calls, 4);
  });

  it("aggregates nothing into nothing", () => {
    const totals = aggregateSpans([]);
    assert.equal(totals.calls, 0);
    assert.equal(totals.costCents, 0);
    assert.deepEqual(totals.byTask, []);
    assert.deepEqual(totals.byAgent, []);
  });
});
