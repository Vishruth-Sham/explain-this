import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const content = readFileSync(new URL("../extension/content.js", import.meta.url), "utf8");
const background = readFileSync(new URL("../extension/background.js", import.meta.url), "utf8");

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
  assert.match(content, /Explaining locally/);
  assert.match(content, /Explaining with more page context/);
  assert.match(background, /insufficient_context/);
});
