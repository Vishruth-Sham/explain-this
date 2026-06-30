# Explain This Chrome extension

This loadable Manifest V3 extension uses the local backend at `http://127.0.0.1:5173`.

1. Start Ollama and the local backend as documented in the project README.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this `extension` directory.
5. Reload a normal webpage, select text, and click **explain this**.

Quick mode sends the selected text, nearby blocks, nearest heading, page title, and URL. **Explain deeper** adds cleaned article/main content. **Explain from first principles** reuses the same selection and context with the first-principles backend mode.

After updating the extension, reload it from `chrome://extensions` and reload the target webpage. Chrome does not inject content scripts into internal `chrome://` pages.
