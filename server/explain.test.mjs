import assert from "node:assert/strict";
import test from "node:test";
import {
  ExplainError,
  buildMessages,
  explainSelection,
  getHealthConfig,
  resolveFirstPrinciplesTimeoutMs,
  resolveTimeoutMs,
  toErrorResponse,
  validateExplainInput,
} from "./explain.mjs";

test("validates, truncates, and supports legacy fields", () => {
  assert.throws(() => validateExplainInput({}), (error) => {
    assert.equal(error.code, "selected_text_required");
    return true;
  });

  const input = validateExplainInput({
    selection: " selected ",
    context: "x".repeat(9_000),
    pageTitle: "Legacy title",
    selected_text: "y".repeat(5_000),
    context_mode: "unknown",
  });
  assert.equal(input.selected_text.length, 4_000);
  assert.equal(input.nearby_text.length, 8_000);
  assert.equal(input.before_text.length, 4_000);
  assert.equal(input.page_title, "Legacy title");
  assert.equal(input.context_mode, "quick");
  assert.equal(input.explanation_mode, "normal");
});

test("builds context-first quick and deep prompts", () => {
  const quick = buildMessages(validateExplainInput({
    selected_text: "A pod is ephemeral.",
    before_text: "Pods are workload units.",
    after_text: "Controllers recreate them.",
  }));
  assert.match(quick[0].content, /source of truth/);
  assert.doesNotMatch(quick[0].content, /primitive concepts/);
  assert.match(quick[1].content, /Pods are workload units/);

  const deep = buildMessages(validateExplainInput({
    selected_text: "A pod is ephemeral.",
    nearby_text: "Nearby",
    main_content: "Full article",
    context_mode: "deep",
  }));
  assert.match(deep[1].content, /Full article/);
});

test("builds the first-principles prompt only for that mode", () => {
  const input = validateExplainInput({
    selected_text: "A controller reconciles state.",
    before_text: "Controllers watch resources.",
    explanation_mode: "first_principles",
  });
  const messages = buildMessages(input);
  assert.equal(input.explanation_mode, "first_principles");
  assert.match(messages[0].content, /What problem this idea is solving/);
  assert.match(messages[0].content, /primitive concepts/);
});

test("calls local Ollama with qwen2.5-coder:3b", async () => {
  let request;
  const logs = [];
  const result = await explainSelection(
    { selected_text: "A Service gives Pods a stable address." },
    {
      fetchImpl: async (url, options) => {
        request = { url, body: JSON.parse(options.body) };
        return new Response(JSON.stringify({ message: { content: "It provides stable discovery for changing Pods." } }));
      },
      logger: (line) => logs.push(line),
    },
  );
  assert.equal(request.url, "http://localhost:11434/api/chat");
  assert.equal(request.body.model, "qwen2.5-coder:3b");
  assert.equal(request.body.stream, false);
  assert.match(result.explanation, /stable discovery/);
  assert.match(logs[0], /model=qwen2\.5-coder:3b mode=quick explanation_mode=normal selected_len=/);
  assert.match(logs[0], /latency_ms=\d+ status=success/);
});

test("routes first-principles explanations to qwen3:4b-thinking", async () => {
  let request;
  const result = await explainSelection(
    {
      selected_text: "A Service gives Pods a stable address.",
      explanation_mode: "first_principles",
    },
    {
      fetchImpl: async (url, options) => {
        request = { url, body: JSON.parse(options.body) };
        return new Response(JSON.stringify({ message: { content: "It starts with changing Pod identities." } }));
      },
      logger: () => {},
    },
  );
  assert.equal(request.body.model, "qwen3:4b-thinking");
  assert.match(request.body.messages[0].content, /step by step/);
  assert.equal(result.explanation_mode, "first_principles");
});

test("detects insufficient context", async () => {
  const result = await explainSelection(
    { selected_text: "NewThing.configure()" },
    {
      fetchImpl: async () => new Response(JSON.stringify({
        message: { content: "I need more context to explain this accurately." },
      })),
      logger: () => {},
    },
  );
  assert.equal(result.insufficient_context, true);
});

test("normalizes Ollama connection, missing model, and timeout errors", async () => {
  await assert.rejects(
    explainSelection(
      { selected_text: "A selected passage." },
      { fetchImpl: async () => { throw new TypeError("fetch failed"); }, logger: () => {} },
    ),
    (error) => error instanceof ExplainError && error.status === 503 && error.code === "ollama_not_running",
  );

  await assert.rejects(
    explainSelection(
      { selected_text: "A selected passage." },
      {
        fetchImpl: async () => new Response(JSON.stringify({ error: "model not found" }), { status: 404 }),
        logger: () => {},
      },
    ),
    (error) => error.status === 503 && error.code === "ollama_model_missing",
  );

  await assert.rejects(
    explainSelection(
      { selected_text: "A selected passage." },
      {
        timeoutMs: 5,
        fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
        }),
        logger: () => {},
      },
    ),
    (error) => error.status === 504 && error.code === "ollama_timeout",
  );
});

test("exposes local defaults", () => {
  assert.equal(resolveTimeoutMs(undefined), 20_000);
  assert.equal(resolveTimeoutMs("45"), 45_000);
  assert.equal(resolveFirstPrinciplesTimeoutMs(undefined), 60_000);
  assert.deepEqual(getHealthConfig(), {
    status: "ok",
    ollama_base_url: "http://localhost:11434",
    model: "qwen2.5-coder:3b",
    first_principles_model: "qwen3:4b-thinking",
  });
});

test("preserves structured request errors", () => {
  assert.deepEqual(toErrorResponse(Object.assign(new Error("Request body is too large."), {
    status: 413,
    code: "body_too_large",
  })), {
    status: 413,
    body: { error: "Request body is too large.", code: "body_too_large" },
  });
});
