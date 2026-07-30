import { validateExplainInput, buildMessages, isInsufficientContext } from "./promptLogic.js";

async function ensureModelReady() {
  if (typeof LanguageModel === "undefined") {
    throw new Error("On-device AI isn't available in this browser. Update Chrome to 138+ and try again.");
  }

  const availability = await LanguageModel.availability();
  console.info("[explain-this] LanguageModel.availability():", availability);

  if (availability === "unavailable") {
    throw new Error(
      "Chrome can't run its on-device model here. It needs 22 GB free on your Chrome profile's drive, plus 4 GB of graphics memory or 16 GB of RAM.",
    );
  }

  if (availability !== "available") {
    LanguageModel.create({
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (event) => {
          console.info(`[explain-this] on-device model download: ${Math.round(event.loaded * 100)}%`);
        });
      },
    })
      .then((session) => session.destroy())
      .catch((error) => console.error("[explain-this] model download failed:", error));
    throw new Error("Downloading the on-device model (first run only). This takes a few minutes — try again shortly.");
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "explain") return;

  let cancelled = false;
  port.onDisconnect.addListener(() => { cancelled = true; });

  port.onMessage.addListener(async (message) => {
    if (message?.type !== "EXPLAIN_SELECTION") return;

    let session;
    try {
      const input = validateExplainInput(message.payload);
      const { systemPrompt, userPrompt } = buildMessages(input);
      await ensureModelReady();

      session = await LanguageModel.create({
        initialPrompts: [{ role: "system", content: systemPrompt }],
      });

      const reader = session.promptStreaming(userPrompt).getReader();
      let explanation = "";

      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) break;
        explanation += value;
        port.postMessage({ type: "CHUNK", text: explanation });
      }
      if (cancelled) return;

      explanation = explanation.trim();
      if (!explanation) throw new Error("The on-device model returned an empty response.");

      port.postMessage({
        type: "DONE",
        explanation,
        context_mode: input.context_mode,
        insufficient_context: isInsufficientContext(explanation),
      });
    } catch (error) {
      console.error("[explain-this]", error);
      if (!cancelled) port.postMessage({ type: "ERROR", error: error.message });
    } finally {
      session?.destroy();
    }
  });
});
