const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/free";
const DEFAULT_TIMEOUT_MS = 25_000;

export class ExplainError extends Error {
  constructor(message, { status = 500, code = "internal_error" } = {}) {
    super(message);
    this.name = "ExplainError";
    this.status = status;
    this.code = code;
  }
}

export function validateExplainInput(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ExplainError("A JSON request body is required.", { status: 400, code: "invalid_request" });
  }

  const selection = typeof payload.selection === "string" ? payload.selection.trim().replace(/\s+/g, " ") : "";
  const context = typeof payload.context === "string" ? payload.context.trim().slice(0, 4_000) : "";
  const pageTitle = typeof payload.pageTitle === "string" ? payload.pageTitle.trim().slice(0, 200) : "";

  if (selection.length < 5) {
    throw new ExplainError("Select at least 5 characters.", { status: 400, code: "selection_too_short" });
  }

  if (selection.length > 2_000) {
    throw new ExplainError("The selected text is too long.", { status: 413, code: "selection_too_long" });
  }

  return { selection, context, pageTitle };
}

export function buildMessages({ selection, context, pageTitle }) {
  return [
    {
      role: "system",
      content:
        "You explain difficult technical documentation to a working software developer who is unfamiliar with this specific system. " +
        "Explain the selected passage in plain language, preserve important technical terms, and mention a prerequisite only when essential. " +
        "Use at most 100 words and no heading, preamble, markdown list, or follow-up question. " +
        "Do not invent behavior that is not supported by the passage or context.",
    },
    {
      role: "user",
      content: [
        pageTitle ? `Page title: ${pageTitle}` : null,
        `Selected passage:\n${selection}`,
        context ? `Nearby context:\n${context}` : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

function parseProviderResponse(rawBody) {
  const body = rawBody.trim();

  if (!body) return null;

  try {
    return JSON.parse(body);
  } catch {
    // Some upstreams occasionally prepend transport noise before the JSON body.
    const objectStart = body.indexOf("{");
    const objectEnd = body.lastIndexOf("}");

    if (objectStart !== -1 && objectEnd > objectStart) {
      try {
        return JSON.parse(body.slice(objectStart, objectEnd + 1));
      } catch {
        // Fall through to the normalized provider error below.
      }
    }

    throw new ExplainError("The model provider returned an invalid response.", {
      status: 502,
      code: "invalid_provider_response",
    });
  }
}

function cleanExplanation(content) {
  return content
    .replace(/<(?:pad|bos|eos)>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function explainSelection(
  payload,
  {
    apiKey = process.env.OPENROUTER_API_KEY,
    model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    dataCollection = process.env.OPENROUTER_DATA_COLLECTION || "deny",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = fetch,
  } = {},
) {
  const input = validateExplainInput(payload);

  if (!apiKey) {
    throw new ExplainError("OpenRouter is not configured.", { status: 503, code: "openrouter_not_configured" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Explain This",
      },
      body: JSON.stringify({
        model,
        messages: buildMessages(input),
        max_tokens: 180,
        temperature: 0.2,
        provider: {
          data_collection: dataCollection,
        },
      }),
      signal: controller.signal,
    });

    const data = parseProviderResponse(await response.text());

    if (!response.ok) {
      const status = response.status === 429 ? 429 : 502;
      const code = response.status === 429 ? "rate_limited" : "provider_error";
      const providerMessage = typeof data?.error?.message === "string" ? data.error.message.trim() : "";
      throw new ExplainError(
        providerMessage ||
          (response.status === 429
            ? "The free model is temporarily rate-limited."
            : "The model provider could not complete the request."),
        { status, code },
      );
    }

    const content = data?.choices?.[0]?.message?.content;
    const explanation = typeof content === "string" ? cleanExplanation(content) : "";
    if (!explanation) {
      throw new ExplainError("The model returned an empty explanation.", {
        status: 502,
        code: "empty_provider_response",
      });
    }

    return {
      explanation,
      model: data.model || model,
      usage: data.usage || null,
    };
  } catch (error) {
    if (error instanceof ExplainError) throw error;
    if (error?.name === "AbortError") {
      throw new ExplainError("The explanation request timed out.", { status: 504, code: "provider_timeout" });
    }
    throw new ExplainError("The model provider is unavailable.", { status: 502, code: "provider_unavailable" });
  } finally {
    clearTimeout(timeout);
  }
}

export function toErrorResponse(error) {
  const normalized =
    error instanceof ExplainError
      ? error
      : new ExplainError("An unexpected server error occurred.", { status: 500, code: "internal_error" });

  return {
    status: normalized.status,
    body: {
      error: {
        code: normalized.code,
        message: normalized.message,
      },
    },
  };
}
