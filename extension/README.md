# Explain This Chrome extension

This loadable Manifest V3 extension uses the local backend at `http://127.0.0.1:5173`.

1. Start Ollama and the local backend as documented in the project README.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this `extension` directory.
5. Reload a normal webpage, select text, and click **explain this**.

Quick mode sends up to four nearby content blocks before and after the selection. **Explain deeper** adds cleaned article/main content. Chrome does not inject content scripts into internal `chrome://` pages.
