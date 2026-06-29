import assert from "node:assert/strict";
import test from "node:test";
import { loadSystemPrompt, parseSystemPrompt } from "./prompt.mjs";

test("loads the explanation prompt from YAML", () => {
  const prompt = loadSystemPrompt();
  assert.match(prompt, /working software developer/);
  assert.match(prompt, /at most 100 words/);
});

test("rejects YAML without a system block", () => {
  assert.throws(() => parseSystemPrompt("version: 1\n"), /system block/);
});
