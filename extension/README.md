# Explain This Chrome extension

This directory is a loadable Manifest V3 extension using the backend at `http://127.0.0.1:5173`.

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this `extension` directory.
4. Reload a normal web page, select at least five characters, and click **explain this**.

Chrome cannot inject this extension into internal `chrome://` pages. When the backend is deployed, update `API_BASE_URL` in `config.js` and its origin in `manifest.json` under `host_permissions`.
