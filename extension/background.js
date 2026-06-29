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
        const message = typeof result?.error === "string" ? result.error : result?.error?.message;
        throw new Error(message || "Local model inference failed.");
      }
      sendResponse({
        ok: true,
        explanation: result.explanation,
        insufficient_context: result.insufficient_context,
        context_mode: result.context_mode,
        explanation_mode: result.explanation_mode,
      });
    })
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
