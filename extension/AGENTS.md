# Chrome extension direction

- Preserve the existing dark graphite “explain this” pill and concise popover.
- Inject the UI through Shadow DOM so host-page styles cannot change it.
- Quick context means up to four meaningful blocks before and after the exact selection, plus the nearest preceding heading, page title, and URL.
- Deep context adds cleaned `article`, `main`, or `[role="main"]` content capped at 20,000 characters.
- Use only local Ollama through the local backend. Do not add OpenRouter or another cloud fallback.
- The extension must call `/api/explain` through `background.js`; never call Ollama directly from the content script.
- Keep quick/deep actions inside the existing popover; do not redesign the pill.
- Keep “Explain from first principles” as a secondary popover action that reuses the current selection and context.
- Route normal explanations to `qwen2.5-coder:3b` and first-principles explanations to `qwen3:4b-thinking`.
- Keep the floating pill label compact. Dismiss the pill or explanation on outside click, Escape, or the close button, not when the page scrolls.
- Style extension UI inside `content.js` because it is injected into a Shadow DOM. Keep scrollbars dark, thin, and low contrast.
- The development extension points to `http://127.0.0.1:5173`; update both `config.js` and `host_permissions` for production.
