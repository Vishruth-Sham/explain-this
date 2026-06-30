# Explain This

Local, context-first explanations for selected text. The Chrome extension extracts the selected passage and nearby page context, sends it to a local Vite API, and the API calls local Ollama models. Page content stays on the machine.

## How It Works

```txt
select text on a webpage
  -> content script captures selected_text and page context
  -> extension service worker POSTs to http://127.0.0.1:5173/api/explain
  -> Vite middleware validates and builds the prompt from prompts/explain.yaml
  -> Ollama runs the selected local model
  -> extension renders the answer in the same popover
```

Normal explanations use `qwen2.5-coder:3b`. First-principles explanations use `qwen3:4b-thinking` and can take noticeably longer.

## Setup

### 1. Install Ollama and models

```bash
brew install ollama
ollama pull qwen2.5-coder:3b
ollama pull qwen3:4b-thinking
ollama serve
```

If Ollama already runs as a service, `ollama serve` may report that the port is already in use. That is fine as long as `curl http://localhost:11434/api/tags` returns model data.

### 2. Configure environment

```bash
cp .env.example .env
```

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:3b
OLLAMA_TIMEOUT_SECONDS=20
OLLAMA_FIRST_PRINCIPLES_MODEL=qwen3:4b-thinking
OLLAMA_FIRST_PRINCIPLES_TIMEOUT_SECONDS=60
```

The app is configured for local Ollama models. Page content is sent only to the local backend and local Ollama instance.

### 3. Install dependencies and run the backend

```bash
pnpm install
pnpm dev
```

The local backend runs at `http://127.0.0.1:5173` and exposes:

- `GET /health`
- `POST /explain`
- `POST /api/explain` for backwards compatibility

### 4. Load the Chrome extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select the repo's `extension` directory.
5. Reload any already-open webpage before testing the extension.

Chrome content scripts do not refresh on existing tabs until the extension and page are reloaded.

## API Contract

The extension sends this shape to `/api/explain`:

```json
{
  "selected_text": "A Service gives Pods a stable address.",
  "before_text": "Pods can be recreated and receive new IP addresses.",
  "after_text": "Clients use the Service instead of tracking each Pod directly.",
  "nearby_text": "Before, selected, and after text combined.",
  "section_heading": "Services",
  "page_title": "Kubernetes Services",
  "page_url": "https://example.com/services",
  "context_mode": "quick",
  "explanation_mode": "normal"
}
```

`context_mode` can be `quick` or `deep`. Deep mode also sends `main_content`, capped server-side at 20,000 characters.

`explanation_mode` can be `normal` or `first_principles`.

## Manual Checks

```bash
curl http://127.0.0.1:5173/health
```

Expected:

```json
{
  "status": "ok",
  "ollama_base_url": "http://localhost:11434",
  "model": "qwen2.5-coder:3b",
  "first_principles_model": "qwen3:4b-thinking"
}
```

Normal explanation:

```bash
curl -X POST http://127.0.0.1:5173/explain \
  -H "Content-Type: application/json" \
  -d '{
    "selected_text": "The function memoizes recursive calls to avoid recomputing overlapping subproblems.",
    "before_text": "Dynamic programming can be implemented using recursion and caching.",
    "after_text": "This reduces the time complexity because each state is computed once.",
    "section_heading": "Memoization",
    "page_title": "Dynamic Programming Guide",
    "page_url": "https://example.com/dp-guide",
    "context_mode": "quick"
  }'
```

First-principles explanation:

```bash
curl -X POST http://127.0.0.1:5173/explain \
  -H "Content-Type: application/json" \
  -d '{
    "selected_text": "A Service gives Pods a stable address.",
    "before_text": "Pods can be recreated and receive new IP addresses.",
    "after_text": "Clients use the Service instead of tracking each Pod directly.",
    "context_mode": "quick",
    "explanation_mode": "first_principles"
  }'
```

## Tests

```bash
pnpm test
pnpm build
node --check extension/content.js
node --check extension/background.js
```
