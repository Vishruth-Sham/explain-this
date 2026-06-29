import assert from "node:assert/strict";
import test from "node:test";
import { ExplainError, buildMessages, explainSelection, validateExplainInput } from "./explain.mjs";

test("validates and bounds explanation input", () => {
  assert.throws(() => validateExplainInput({ selection: "aws" }), (error) => {
    assert.equal(error.code, "selection_too_short");
    return true;
  });

  const input = validateExplainInput({
    selection: "  Kubernetes   Service  ",
    context: "x".repeat(5_000),
    pageTitle: "Kubernetes docs",
  });
  assert.equal(input.selection, "Kubernetes Service");
  assert.equal(input.context.length, 4_000);
});

test("builds a concise developer-focused prompt", () => {
  const messages = buildMessages({ selection: "A pod is ephemeral.", context: "Pods may be recreated.", pageTitle: "Pods" });
  assert.equal(messages[0].role, "system");
  assert.match(messages[0].content, /100 words/);
  assert.match(messages[1].content, /A pod is ephemeral/);
});

test("calls OpenRouter without exposing provider details to the client", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return new Response(
      JSON.stringify({
        model: "nvidia/test-model:free",
        choices: [{ message: { content: "A Service gives changing Pods one stable network address." } }],
        usage: { total_tokens: 42 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const result = await explainSelection(
    { selection: "A Service provides a stable virtual IP for a set of Pods." },
    { apiKey: "test-key", fetchImpl },
  );

  assert.equal(request.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(request.options.headers.Authorization, "Bearer test-key");
  assert.equal(request.body.model, "openrouter/free");
  assert.equal(request.body.provider.data_collection, "deny");
  assert.match(result.explanation, /stable network address/);
});

test("normalizes missing configuration and provider rate limits", async () => {
  await assert.rejects(
    explainSelection({ selection: "A sufficiently long selected passage." }, { apiKey: "" }),
    (error) => error instanceof ExplainError && error.status === 503 && error.code === "openrouter_not_configured",
  );

  await assert.rejects(
    explainSelection(
      { selection: "A sufficiently long selected passage." },
      {
        apiKey: "test-key",
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: { message: "limited" } }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }),
      },
    ),
    (error) => error.status === 429 && error.code === "rate_limited",
  );
});

test("removes provider control tokens from explanations", async () => {
  const result = await explainSelection(
    { selection: "A sufficiently long selected passage." },
    {
      apiKey: "test-key",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            model: "google/test-model:free",
            choices: [{ message: { content: "A clear explanation.<pad><pad>" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    },
  );

  assert.equal(result.explanation, "A clear explanation.");
});
