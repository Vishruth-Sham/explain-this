import { explainSelection, getHealthConfig, toErrorResponse } from "./explain.mjs";

const MAX_BODY_BYTES = 50_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 20;

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let rejected = false;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      if (rejected) return;
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        rejected = true;
        reject(Object.assign(new Error("Request body is too large."), { status: 413, code: "body_too_large" }));
      }
    });
    request.on("end", () => {
      if (rejected) return;
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON."), { status: 400, code: "invalid_json" }));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

export function explainApiPlugin({ env = process.env } = {}) {
  const clients = new Map();

  async function handleExplain(request, response) {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, { error: "Use POST.", code: "method_not_allowed" });
      return;
    }

    const now = Date.now();
    const clientId = request.socket.remoteAddress || "local";
    const recent = (clients.get(clientId) || []).filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_REQUESTS) {
      sendJson(response, 429, { error: "Too many explanation requests.", code: "rate_limited" });
      return;
    }
    recent.push(now);
    clients.set(clientId, recent);

    try {
      const payload = await readJsonBody(request);
      const result = await explainSelection(payload, {
        baseUrl: env.OLLAMA_BASE_URL,
        model: env.OLLAMA_MODEL,
        timeoutMs: env.OLLAMA_TIMEOUT_SECONDS ? Number(env.OLLAMA_TIMEOUT_SECONDS) * 1_000 : undefined,
      });
      sendJson(response, 200, result);
    } catch (error) {
      const normalized = toErrorResponse(error);
      sendJson(response, normalized.status, normalized.body);
    }
  }

  return {
    name: "explain-api",
    configureServer(server) {
      server.middlewares.use("/health", (request, response) => {
        if (request.method !== "GET") return sendJson(response, 405, { error: "Use GET.", code: "method_not_allowed" });
        sendJson(response, 200, getHealthConfig({ baseUrl: env.OLLAMA_BASE_URL, model: env.OLLAMA_MODEL }));
      });
      server.middlewares.use("/api/explain", handleExplain);
      server.middlewares.use("/explain", handleExplain);
    },
  };
}
