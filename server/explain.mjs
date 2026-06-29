import { loadPromptTemplates } from "./prompt.mjs";

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "qwen2.5-coder:3b";
const DEFAULT_FIRST_PRINCIPLES_MODEL = "qwen3:4b-thinking";
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_FIRST_PRINCIPLES_TIMEOUT_MS = 60_000;
const INSUFFICIENT_CONTEXT = "I need more context to explain this accurately.";
const PROMPTS = loadPromptTemplates();

const LIMITS = {
  selected_text: 4_000,
  before_text: 4_000,
  after_text: 4_000,
  nearby_text: 8_000,
  section_heading: 500,
  page_title: 300,
  page_url: 1_000,
  main_content: 20_000,
};

export class ExplainError extends Error {
  constructor(message, { status = 500, code = "internal_error" } = {}) {
    super(message);
    this.name = "ExplainError";
    this.status = status;
    this.code = code;
  }
}

function boundedString(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export function validateExplainInput(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ExplainError("A JSON request body is required.", { status: 400, code: "invalid_request" });
  }

  const selectedText = boundedString(payload.selected_text ?? payload.selection, LIMITS.selected_text);
  if (!selectedText) {
    throw new ExplainError("Selected text is required.", { status: 400, code: "selected_text_required" });
  }

  const legacyContext = boundedString(payload.context, LIMITS.nearby_text);
  const contextMode = payload.context_mode === "deep" ? "deep" : "quick";
  const explanationMode = payload.explanation_mode === "first_principles" ? "first_principles" : "normal";
  const input = {
    selected_text: selectedText,
    before_text: boundedString(payload.before_text, LIMITS.before_text),
    after_text: boundedString(payload.after_text, LIMITS.after_text),
    nearby_text: boundedString(payload.nearby_text, LIMITS.nearby_text) || legacyContext,
    section_heading: boundedString(payload.section_heading, LIMITS.section_heading),
    page_title: boundedString(payload.page_title ?? payload.pageTitle, LIMITS.page_title),
    page_url: boundedString(payload.page_url, LIMITS.page_url),
    main_content: boundedString(payload.main_content, LIMITS.main_content),
    context_mode: contextMode,
    explanation_mode: explanationMode,
  };

  if (!input.before_text && !input.after_text && legacyContext) input.before_text = legacyContext.slice(0, LIMITS.before_text);
  return input;
}

function interpolate(template, values) {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_match, key) => values[key] || "");
}

export function buildMessages(input) {
  const template = input.context_mode === "deep" ? PROMPTS.deep : PROMPTS.quick;
  const systemPrompt = input.explanation_mode === "first_principles"
    ? `${PROMPTS.system}\n\n${PROMPTS.first_principles}`
    : PROMPTS.system;
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: interpolate(template, input) },
  ];
}

export function resolveTimeoutMs(value = process.env.OLLAMA_TIMEOUT_SECONDS) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1_000 : DEFAULT_TIMEOUT_MS;
}

export function resolveFirstPrinciplesTimeoutMs(value = process.env.OLLAMA_FIRST_PRINCIPLES_TIMEOUT_SECONDS) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1_000 : DEFAULT_FIRST_PRINCIPLES_TIMEOUT_MS;
}

function isInsufficientContext(explanation) {
  return explanation.trim().toLowerCase().startsWith(INSUFFICIENT_CONTEXT.toLowerCase());
}

function requestLog(input, { model, latencyMs, status }) {
  return [
    "/explain",
    `model=${model}`,
    `mode=${input.context_mode}`,
    `explanation_mode=${input.explanation_mode}`,
    `selected_len=${input.selected_text.length}`,
    `before_len=${input.before_text.length}`,
    `after_len=${input.after_text.length}`,
    `nearby_len=${input.nearby_text.length}`,
    `main_content_len=${input.main_content.length}`,
    `latency_ms=${latencyMs}`,
    `status=${status}`,
  ].join(" ");
}

export async function explainSelection(
  payload,
  {
    baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL,
    model = process.env.OLLAMA_MODEL || DEFAULT_MODEL,
    firstPrinciplesModel = process.env.OLLAMA_FIRST_PRINCIPLES_MODEL || DEFAULT_FIRST_PRINCIPLES_MODEL,
    timeoutMs = resolveTimeoutMs(),
    firstPrinciplesTimeoutMs = resolveFirstPrinciplesTimeoutMs(),
    fetchImpl = fetch,
    logger = console.info,
  } = {},
) {
  const input = validateExplainInput(payload);
  const selectedModel = input.explanation_mode === "first_principles" ? firstPrinciplesModel : model;
  const selectedTimeoutMs = input.explanation_mode === "first_principles" ? firstPrinciplesTimeoutMs : timeoutMs;
  const startedAt = Date.now();
  let status = "error";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), selectedTimeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: selectedModel, stream: false, messages: buildMessages(input) }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = typeof data?.error === "string" ? data.error : "";
      if (response.status === 404 || /model.*not found|not found.*model/i.test(detail)) {
        throw new ExplainError(`Model not found. Install it with: ollama pull ${selectedModel}`, {
          status: 503,
          code: "ollama_model_missing",
        });
      }
      throw new ExplainError("Local model inference failed.", { status: 500, code: "ollama_inference_failed" });
    }

    const explanation = typeof data?.message?.content === "string" ? data.message.content.trim() : "";
    if (!explanation) {
      throw new ExplainError("Local model inference failed.", { status: 500, code: "ollama_inference_failed" });
    }

    status = "success";
    return {
      explanation,
      model: selectedModel,
      context_mode: input.context_mode,
      explanation_mode: input.explanation_mode,
      insufficient_context: isInsufficientContext(explanation),
    };
  } catch (error) {
    if (error instanceof ExplainError) {
      status = error.code;
      throw error;
    }
    if (error?.name === "AbortError") {
      status = "timeout";
      throw new ExplainError("Local model timed out. Try shorter selected text or use quick mode.", {
        status: 504,
        code: "ollama_timeout",
      });
    }
    status = "ollama_unavailable";
    throw new ExplainError("Ollama is not running. Start it with: ollama serve", {
      status: 503,
      code: "ollama_not_running",
    });
  } finally {
    clearTimeout(timeout);
    logger(requestLog(input, { model: selectedModel, latencyMs: Date.now() - startedAt, status }));
  }
}

export function getHealthConfig({
  baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL,
  model = process.env.OLLAMA_MODEL || DEFAULT_MODEL,
  firstPrinciplesModel = process.env.OLLAMA_FIRST_PRINCIPLES_MODEL || DEFAULT_FIRST_PRINCIPLES_MODEL,
} = {}) {
  return { status: "ok", ollama_base_url: baseUrl, model, first_principles_model: firstPrinciplesModel };
}

export function toErrorResponse(error) {
  const normalized = error instanceof ExplainError
    ? error
    : Number.isInteger(error?.status)
      ? new ExplainError(error.message, { status: error.status, code: error.code || "invalid_request" })
      : new ExplainError("Local model inference failed.", { status: 500, code: "ollama_inference_failed" });
  return { status: normalized.status, body: { error: normalized.message, code: normalized.code } };
}
