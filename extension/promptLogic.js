import { PROMPTS } from "./prompts.js";

export const INSUFFICIENT_CONTEXT = "I need more context to explain this accurately.";

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

function boundedString(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export function validateExplainInput(payload) {
  const selectedText = boundedString(payload?.selected_text, LIMITS.selected_text);
  if (!selectedText) throw new Error("Selected text is required.");

  return {
    selected_text: selectedText,
    before_text: boundedString(payload.before_text, LIMITS.before_text),
    after_text: boundedString(payload.after_text, LIMITS.after_text),
    nearby_text: boundedString(payload.nearby_text, LIMITS.nearby_text),
    section_heading: boundedString(payload.section_heading, LIMITS.section_heading),
    page_title: boundedString(payload.page_title, LIMITS.page_title),
    page_url: boundedString(payload.page_url, LIMITS.page_url),
    main_content: boundedString(payload.main_content, LIMITS.main_content),
    context_mode: payload.context_mode === "deep" ? "deep" : "quick",
  };
}

function interpolate(template, values) {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_match, key) => values[key] || "");
}

export function buildMessages(input) {
  const template = input.context_mode === "deep" ? PROMPTS.deep : PROMPTS.quick;
  return { systemPrompt: PROMPTS.system, userPrompt: interpolate(template, input) };
}

export function isInsufficientContext(explanation) {
  return explanation.trim().toLowerCase().startsWith(INSUFFICIENT_CONTEXT.toLowerCase());
}
