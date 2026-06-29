# Explain This

Interactive prototype for a browser reading aid: select text, open the floating **explain this** pill, and expand it into a concise AI explanation.

## Run locally

```bash
pnpm install
cp .env.example .env
# Add your OpenRouter key to .env
pnpm dev
```

The local Vite server exposes `POST /api/explain`. A Vercel-compatible function is also available at `api/explain.js`.

## Current scope

- Selection-aware floating pill
- Loading and explanation states
- Close and Escape dismissal
- Desktop and mobile layouts
- Protected OpenRouter API key on the server
- `openrouter/free` model routing
- Bounded inputs, request timeouts, privacy-aware provider routing, and normalized errors
- Local fallback explanation when OpenRouter is unavailable or not configured

## Configuration

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=openrouter/free
OPENROUTER_DATA_COLLECTION=deny
```

`OPENROUTER_DATA_COLLECTION=deny` restricts routing to providers that OpenRouter marks as not collecting user data. Set it to `allow` only if you accept the provider's data policy and need broader free-model availability.

## Tests

```bash
pnpm test
pnpm build
```

Chrome extension packaging is the next implementation layer.
