import type { ChatErrorCode, ChatRequest, ChatSuccess } from "../../shared/api-types.ts";

/** The server's error codes, plus one only the browser can see: the server was never reached. */
export type ClientErrorCode = ChatErrorCode | "network_error";

export type ClientChatResult = ChatSuccess | { ok: false; error: ClientErrorCode; retryAfterSeconds?: number };

/** Sends one guest message. Never throws: every failure comes back as an error code the UI can explain. */
export async function sendChat(request: ChatRequest): Promise<ClientChatResult> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    return { ok: false, error: "network_error" };
  }

  const body: unknown = await response.json().catch(() => null);
  if (typeof body === "object" && body !== null && "ok" in body) return body as ClientChatResult;
  return { ok: false, error: "internal_error" };
}
