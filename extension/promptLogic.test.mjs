import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildMessages, isInsufficientContext, validateExplainInput } from "./promptLogic.js";

test("requires selected text", () => {
  assert.throws(() => validateExplainInput({}), /Selected text is required/);
});

test("truncates fields to their limits and normalizes modes", () => {
  const input = validateExplainInput({
    selected_text: "y".repeat(5_000),
    nearby_text: "x".repeat(9_000),
    context_mode: "unknown",
  });
  assert.equal(input.selected_text.length, 4_000);
  assert.equal(input.nearby_text.length, 8_000);
  assert.equal(input.context_mode, "quick");
});

test("builds context-first quick and deep prompts", () => {
  const quick = buildMessages(validateExplainInput({
    selected_text: "A pod is ephemeral.",
    before_text: "Pods are workload units.",
    after_text: "Controllers recreate them.",
  }));
  assert.match(quick.systemPrompt, /source of truth/);
  assert.doesNotMatch(quick.systemPrompt, /primitive concepts/);
  assert.match(quick.userPrompt, /Pods are workload units/);

  const deep = buildMessages(validateExplainInput({
    selected_text: "A pod is ephemeral.",
    nearby_text: "Nearby",
    main_content: "Full article",
    context_mode: "deep",
  }));
  assert.match(deep.userPrompt, /Full article/);
});

test("detects insufficient context", () => {
  assert.equal(isInsufficientContext("I need more context to explain this accurately."), true);
  assert.equal(isInsufficientContext("A pod is ephemeral."), false);
});

const content = readFileSync(new URL("./content.js", import.meta.url), "utf8");
const background = readFileSync(new URL("./background.js", import.meta.url), "utf8");

test("extension sends the full quick context contract", () => {
  for (const field of [
    "selected_text",
    "before_text",
    "after_text",
    "nearby_text",
    "section_heading",
    "page_title",
    "page_url",
    "context_mode",
  ]) {
    assert.match(content, new RegExp(field));
  }
});

test("extension supports deep and insufficient-context actions", () => {
  assert.match(content, /main_content/);
  assert.match(content, /Explain deeper/);
  assert.match(content, /Try with more page context/);
  assert.doesNotMatch(content, /first principles/i);
  assert.match(background, /insufficient_context/);
});

test("captureSelection only reacts to a real selection change", () => {
  // Every mouseup schedules a capture, including the one from clicking "explain this" itself —
  // that click doesn't change the page selection. Without this guard, the click's own mouseup
  // re-captures the unchanged selection a moment later and clobbers the popover it just opened.
  assert.match(content, /selectedText === selected\?\.selected_text/);
  // The mouseup listener must not gate on where the mouse was released (event.composedPath) —
  // a drag onto new text can easily end with the release point back over our own popover.
  assert.doesNotMatch(content, /mouseup["'],?\s*\(event\)\s*=>\s*\{\s*if\s*\(event\.composedPath/);
});

test("extension streams tokens over a long-lived port", () => {
  assert.match(content, /chrome\.runtime\.connect/);
  assert.match(content, /"CHUNK"/);
  assert.match(background, /chrome\.runtime\.onConnect/);
  assert.match(background, /promptStreaming/);
  assert.doesNotMatch(background, /sendResponse/);
});
