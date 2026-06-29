import { explainSelection, toErrorResponse } from "../server/explain.mjs";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Use POST.", code: "method_not_allowed" });
    return;
  }

  try {
    let payload;
    try {
      payload = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    } catch {
      response.status(400).json({ error: "Request body must be valid JSON.", code: "invalid_json" });
      return;
    }
    const result = await explainSelection(payload);
    response.setHeader("Cache-Control", "no-store");
    response.status(200).json(result);
  } catch (error) {
    const normalized = toErrorResponse(error);
    response.status(normalized.status).json(normalized.body);
  }
}
