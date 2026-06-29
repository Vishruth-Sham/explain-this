# Chrome extension direction

- Preserve the existing dark graphite “explain this” pill and concise popover.
- Keep version one single-purpose: no modes, tabs, or follow-up chat.
- Inject the UI through Shadow DOM so host-page styles cannot change it.
- Quick context means up to four meaningful blocks before and after the exact selection, plus the nearest preceding heading, page title, and URL.
- Deep context adds cleaned `article`, `main`, or `[role="main"]` content capped at 20,000 characters.
- Use only local Ollama with `qwen2.5-coder:3b`. Do not add cloud fallback.
- Keep quick/deep actions inside the existing popover; do not redesign the pill.
- Keep the floating pill label compact, and dismiss the pill or explanation whenever the user clicks outside the extension surface.
- The development extension points to `http://127.0.0.1:5173`; update both `config.js` and `host_permissions` for production.
