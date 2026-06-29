import { explainSelection, toErrorResponse } from "./explain.mjs";

const MAX_BODY_BYTES = 12_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 20;

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request body is too large."), { status: 413, code: "body_too_large" }));
      }
    });
    request.on("end", () => {
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

  return {
    name: "explain-api",
    configureServer(server) {
      server.middlewares.use("/api/explain", async (request, response) => {
        if (request.method !== "POST") {
          response.setHeader("Allow", "POST");
          sendJson(response, 405, { error: { code: "method_not_allowed", message: "Use POST." } });
          return;
        }

        const now = Date.now();
        const clientId = request.socket.remoteAddress || "local";
        const recent = (clients.get(clientId) || []).filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
        if (recent.length >= RATE_LIMIT_REQUESTS) {
          sendJson(response, 429, { error: { code: "rate_limited", message: "Too many explanation requests." } });
          return;
        }
        recent.push(now);
        clients.set(clientId, recent);

        try {
          const payload = await readJsonBody(request);
          const result = await explainSelection(payload, {
            apiKey: env.OPENROUTER_API_KEY,
            model: env.OPENROUTER_MODEL,
            dataCollection: env.OPENROUTER_DATA_COLLECTION,
          });
          sendJson(response, 200, result);
        } catch (error) {
          if (error?.status && !(error instanceof TypeError)) {
            sendJson(response, error.status, { error: { code: error.code || "invalid_request", message: error.message } });
            return;
          }
          const normalized = toErrorResponse(error);
          sendJson(response, normalized.status, normalized.body);
        }
      });
    },
  };
}
