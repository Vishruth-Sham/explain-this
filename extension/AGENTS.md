# Chrome extension direction

- Preserve the existing dark graphite “explain this” pill and concise popover.
- Keep version one single-purpose: no modes, tabs, or follow-up chat.
- Inject the UI through Shadow DOM so host-page styles cannot change it.
- Context means the selected block plus its immediately adjacent text blocks, capped server-side.
- Keep `OPENROUTER_API_KEY` on the backend. The extension must call `/api/explain` through its service worker.
- The development extension points to `http://127.0.0.1:5173`; update both `config.js` and `host_permissions` for production.
