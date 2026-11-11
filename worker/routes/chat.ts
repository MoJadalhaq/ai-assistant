import { Hono } from "hono";
import type { ChatFailure, ChatRequest, ChatSuccess, ChatTurn } from "../../shared/api-types.ts";
import { isRecord } from "../../shared/text.ts";
import { conversationLanguage, runAgent } from "../ai/agent.ts";
import type { AgentReply } from "../ai/agent.ts";
import { createGeminiClient, ModelBusyError } from "../ai/gemini.ts";
import { D1Repository } from "../data/d1-repository.ts";

const MAX_MESSAGE_LENGTH = 1000;
const MAX_TURN_LENGTH = 4000;
/** Only the most recent turns are sent to the model: enough for a booking, and it caps the tokens per request. */
const MAX_HISTORY_TURNS = 12;
const BURST_RETRY_SECONDS = 60;
const MAX_TOOL_CALLS_PER_TURN = 8;
const MAX_TOOL_CALLS_JSON_LENGTH = 12_000;

export const chat = new Hono<{ Bindings: Env }>();

chat.post("/", async (c) => {
  // 1. Burst limit per visitor. Checked before anything else so floods cost nothing.
  //    The IP is the only identifier an anonymous guest has (see docs/PLAN.md, decision 10).
  const visitor = c.req.header("cf-connecting-ip") ?? "local";
  const { success } = await c.env.CHAT_RATE_LIMITER.limit({ key: visitor });
  if (!success) return c.json(failure("rate_limited", BURST_RETRY_SECONDS), 429);

  // 2. Validate the request body.
  const parsed = parseChatRequest(await c.req.json().catch(() => null));
  if ("problems" in parsed) return c.json({ ...failure("invalid_request"), problems: parsed.problems }, 400);

  if (!c.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set");
    return c.json(failure("not_configured"), 500);
  }

  // 3. Run the tool loop.
  const { sessionId, message, history } = parsed;
  const now = new Date();
  try {
    const result = await runAgent({
      model: createGeminiClient(c.env.GEMINI_API_KEY, c.env.GEMINI_MODEL),
      history,
      message,
      ctx: {
        repo: new D1Repository(c.env.DB),
        now,
        sessionId,
        language: conversationLanguage(history, message),
      },
    });

    // Logging happens after the response is sent, so it never slows the reply down.
    c.executionCtx.waitUntil(logTurn(c.env.DB, sessionId, message, result, now));

    const body: ChatSuccess = { ok: true, reply: result.reply, events: result.events, toolCalls: result.toolCalls };
    return c.json(body);
  } catch (error) {
    if (error instanceof ModelBusyError) return c.json(failure("model_busy", error.retryAfterSeconds), 429);
    console.error("Chat turn failed:", error);
    return c.json(failure("internal_error"), 500);
  }
});

function failure(error: ChatFailure["error"], retryAfterSeconds?: number): ChatFailure {
  return retryAfterSeconds ? { ok: false, error, retryAfterSeconds } : { ok: false, error };
}

/** Checks the body by hand: three fields don't justify a validation library. */
export function parseChatRequest(body: unknown): ChatRequest | { problems: string[] } {
  const problems: string[] = [];
  if (!isRecord(body)) return { problems: ["body must be a JSON object"] };

  const { sessionId, message, history } = body;
  if (typeof sessionId !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(sessionId)) {
    problems.push("sessionId: 8 to 64 letters, digits or dashes");
  }
  if (typeof message !== "string" || message.trim() === "" || message.length > MAX_MESSAGE_LENGTH) {
    problems.push(`message: non-empty text, at most ${MAX_MESSAGE_LENGTH} characters`);
  }
  if (!Array.isArray(history) || !history.every(isChatTurn)) {
    problems.push("history: a list of { role: 'user' | 'assistant', text, toolCalls? }");
  }
  if (problems.length > 0) return { problems };

  return {
    sessionId: sessionId as string,
    message: (message as string).trim(),
    history: (history as ChatTurn[]).slice(-MAX_HISTORY_TURNS),
  };
}

function isChatTurn(value: unknown): value is ChatTurn {
  if (!isRecord(value)) return false;
  const roleOk = value.role === "user" || value.role === "assistant";
  const textOk = typeof value.text === "string" && value.text.length <= MAX_TURN_LENGTH;
  const callsOk = value.toolCalls === undefined || isToolCallList(value.toolCalls);
  return roleOk && textOk && callsOk;
}

function isToolCallList(value: unknown): boolean {
  if (!Array.isArray(value) || value.length > MAX_TOOL_CALLS_PER_TURN) return false;
  if (JSON.stringify(value).length > MAX_TOOL_CALLS_JSON_LENGTH) return false;
  return value.every((call) => isRecord(call) && typeof call.name === "string" && isRecord(call.args) && isRecord(call.result));
}

/** Keeps a short transcript so staff can read the conversation behind a ticket. Wiped by the daily reset. */
async function logTurn(db: D1Database, sessionId: string, message: string, result: AgentReply, now: Date) {
  const insert = db.prepare(
    "INSERT INTO conversations (session_id, role, content, language, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  const at = now.toISOString();
  const rows = [insert.bind(sessionId, "user", message, null, at)];
  if (result.toolCalls.length > 0) rows.push(insert.bind(sessionId, "tool", JSON.stringify(result.toolCalls), null, at));
  rows.push(insert.bind(sessionId, "assistant", result.reply, null, at));

  try {
    await db.batch(rows);
  } catch (error) {
    console.error("Could not log the conversation:", error);
  }
}
