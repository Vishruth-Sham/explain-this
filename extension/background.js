import { API_BASE_URL } from "./config.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EXPLAIN_SELECTION") return false;

  fetch(`${API_BASE_URL}/api/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message.payload),
  })
    .then(async (response) => {
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.explanation) {
        throw new Error(result?.error?.message || "The explanation service is unavailable.");
      }
      sendResponse({ ok: true, explanation: result.explanation });
    })
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
