# Explain This

Local, context-first explanations for selected text. The Chrome extension extracts surrounding page context and sends it to a local Ollama-backed API. No page content or model request is sent to a cloud provider.

## Architecture

```txt
Chrome extension → local Vite backend → Ollama → mode-specific local model
```

## Install Ollama and the model

```bash
brew install ollama
ollama pull qwen2.5-coder:3b
ollama pull qwen3:4b-thinking
ollama serve
```

## Configure

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

## Run locally

```bash
pnpm install
pnpm dev
```

The backend exposes:

- `GET /health`
- `POST /explain`
- `POST /api/explain` for backwards compatibility

## Test health

```bash
curl http://127.0.0.1:5173/health
```

Expected:

```json
{
  "status": "ok",
  "ollama_base_url": "http://localhost:11434",
  "model": "qwen2.5-coder:3b"
}
```

## Test an explanation

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

## Chrome extension

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the [`extension`](./extension) directory. Reload the webpage after loading or updating the extension.

Quick mode sends the selected text, nearby blocks, nearest section heading, page title, and URL. **Explain deeper** sends cleaned main-page content capped at 20,000 characters.

Normal explanations use `qwen2.5-coder:3b`. **Explain from first principles** reuses the current context, applies the first-principles prompt, and uses `qwen3:4b-thinking`.

## Tests

```bash
pnpm test
pnpm build
node --check extension/content.js
node --check extension/background.js
```
