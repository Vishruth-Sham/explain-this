import { readFileSync } from "node:fs";

const PROMPT_PATH = new URL("../prompts/explain.yaml", import.meta.url);

export function parseSystemPrompt(source) {
  const lines = source.split(/\r?\n/);
  const systemIndex = lines.findIndex((line) => /^system:\s*\|\s*$/.test(line));

  if (systemIndex === -1) {
    throw new Error("Prompt YAML must contain a system block.");
  }

  const block = [];
  for (const line of lines.slice(systemIndex + 1)) {
    if (!line.trim()) {
      block.push("");
      continue;
    }

    if (!/^\s+/.test(line)) break;
    block.push(line.replace(/^\s{2}/, ""));
  }

  const prompt = block.join("\n").trim();
  if (!prompt) throw new Error("Prompt YAML system block cannot be empty.");
  return prompt;
}

export function loadSystemPrompt() {
  return parseSystemPrompt(readFileSync(PROMPT_PATH, "utf8"));
}
