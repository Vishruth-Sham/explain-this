# Prototype Instructions

Run the local server yourself and open the preview in the in-app browser. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Product direction

- The core interaction is a floating dark pill reading “explain this” that appears above selected text.
- Clicking the pill expands it into one concise explanation popover.
- Keep version one single-purpose: no explanation modes, tabs, or follow-up chat.
- Match the supplied dark graphite visual reference with a blue selection state and restrained elevation.
- Keep `OPENROUTER_API_KEY` server-side. The client calls `/api/explain` and must never embed a shared provider key.
