# Explain This Chrome extension

This loadable Manifest V3 extension explains selected text using Chrome's built-in on-device AI (Gemini Nano) — no backend required.

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this `extension` directory.
4. Reload a normal webpage, select text, and click **explain this**.

Quick mode sends the selected text, nearby blocks, nearest heading, page title, and URL. **Explain deeper** adds cleaned article/main content.

After updating the extension, reload it from `chrome://extensions` and reload the target webpage. Chrome does not inject content scripts into internal `chrome://` pages.

Requires Chrome 138+ for the on-device Prompt API (`LanguageModel`). If the model isn't available yet, the popover shows a clear error instead of failing silently.
