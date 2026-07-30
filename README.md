# Explain This

Local, context-first explanations for selected text. The Chrome extension extracts the selected passage and nearby page context and explains it using Chrome's built-in on-device AI (Gemini Nano). No server, no accounts, no network calls — page content never leaves the machine.

## How It Works

```txt
select text on a webpage
  -> content script captures selected_text and page context
  -> extension service worker prompts the on-device model directly
  -> extension renders the answer in the same popover
```

Requires Chrome 138+. On first use, Chrome downloads the on-device model in the background (needs free disk space); the extension will report a clear error if the model isn't available yet.

## Setup

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select the repo's `extension` directory.
5. Reload any already-open webpage before testing the extension.

Chrome content scripts do not refresh on existing tabs until the extension and page are reloaded.

## Usage

Select text on a webpage and click **explain this**. **Explain deeper** re-runs the same selection with the full article pulled in as context, capped at 20,000 characters.

## Tests

```bash
node --test extension/*.test.mjs
node --check extension/content.js
node --check extension/background.js
```
