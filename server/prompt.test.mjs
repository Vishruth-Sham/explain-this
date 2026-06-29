import assert from "node:assert/strict";
import test from "node:test";
import { loadPromptTemplates, parsePromptBlocks } from "./prompt.mjs";

test("loads system, quick, and deep prompts from YAML", () => {
  const prompts = loadPromptTemplates();
  assert.match(prompts.system, /surrounding context as the source of truth/);
  assert.match(prompts.quick, /Text before selection/);
  assert.match(prompts.deep, /Main page content/);
});

test("rejects YAML without every required prompt block", () => {
  assert.throws(() => parsePromptBlocks("system: |\n  hello\n"), /quick block/);
});
