import { readFileSync } from "node:fs";

const PROMPT_PATH = new URL("../prompts/explain.yaml", import.meta.url);

export function parsePromptBlocks(source) {
  const lines = source.split(/\r?\n/);
  const blocks = {};

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^([a-z_]+):\s*\|\s*$/);
    if (!match) continue;

    const content = [];
    for (index += 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line && !/^\s+/.test(line)) {
        index -= 1;
        break;
      }
      content.push(line.replace(/^\s{2}/, ""));
    }
    blocks[match[1]] = content.join("\n").trim();
  }

  for (const key of ["system", "quick", "deep", "first_principles"]) {
    if (!blocks[key]) throw new Error(`Prompt YAML must contain a ${key} block.`);
  }
  return blocks;
}

export function loadPromptTemplates() {
  return parsePromptBlocks(readFileSync(PROMPT_PATH, "utf8"));
}
