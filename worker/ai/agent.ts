// The tool loop: call the model, run the tools it asks for, give it the results, repeat
// until it answers with text. Used by /api/chat, the terminal chat and the evals.

import type { Content, Part } from "@google/genai";
import type { BookingCard, ChatEvent, ChatTurn, TicketCard, ToolCallSummary } from "../../shared/api-types.ts";
import { detectLanguage, normalizeDigits } from "../../shared/text.ts";
import type { Language } from "../../shared/types.ts";
import { runTool } from "../tools/index.ts";
import type { ToolContext, ToolResult } from "../tools/index.ts";
import type { ModelClient } from "./gemini.ts";
import { buildSystemPrompt } from "./system-prompt.ts";
import { TOOL_DECLARATIONS } from "./tool-declarations.ts";

/**
 * Most model calls for one guest message. A normal turn needs 1 to 3
 * (e.g. check availability, then reply). The cap stops a confused model from looping
 * and burning the free-tier quota.
 */
export const MAX_MODEL_CALLS = 5;

/**
 * Gemini 3 expects a "thought signature" on function calls it made itself. We don't keep the
 * original signatures across requests, and Gemini's docs allow this placeholder for function
 * calls that are replayed into the history rather than freshly generated.
 */
const REPLAYED_CALL_SIGNATURE = "skip_thought_signature_validator";

export interface ToolCallRecord extends ToolCallSummary {
  result: ToolResult;
}

export interface AgentReply {
  reply: string;
  events: ChatEvent[];
  /** Goes back to the browser and returns with the history next time (see ChatTurn.toolCalls). */
  toolCalls: ToolCallRecord[];
}

export interface AgentInput {
  model: ModelClient;
  history: ChatTurn[];
  message: string;
  ctx: ToolContext;
}

export async function runAgent({ model, history, message, ctx }: AgentInput): Promise<AgentReply> {
  const systemInstruction = buildSystemPrompt(ctx.now, detectLanguage(message));
  const contents: Content[] = [
    ...history.flatMap(toContents),
    { role: "user", parts: [{ text: normalizeDigits(message) }] },
  ];
  const toolCalls: ToolCallRecord[] = [];
  const toolCtx: ToolContext = { ...ctx, latestGuestMessage: message };

  for (let call = 1; call <= MAX_MODEL_CALLS; call++) {
    const turn = await model.generate({ systemInstruction, contents, tools: TOOL_DECLARATIONS });

    // Appended exactly as received. Gemini 3 validates the thought signatures inside it on the
    // next call, and rejects the request if they were dropped or changed.
    contents.push(turn.content);

    if (turn.functionCalls.length === 0) {
      return finish(turn.text || fallbackReply(ctx.language), toolCalls);
    }

    // Tools run one after another, not in parallel: a check_availability followed by a
    // create_booking_hold in the same turn must happen in that order.
    const responses: Part[] = [];
    for (const functionCall of turn.functionCalls) {
      const name = functionCall.name ?? "";
      const args = functionCall.args ?? {};
      const result = await runTool(name, args, toolCtx);
      toolCalls.push({ name, args, result });
      responses.push({ functionResponse: { id: functionCall.id, name, response: result } });
    }
    contents.push({ role: "user", parts: responses });
  }

  return finish(fallbackReply(ctx.language), toolCalls);
}

/** Language of the whole conversation so far: a guest who mixed languages once stays "mixed". */
export function conversationLanguage(history: ChatTurn[], message: string): Language {
  const guestText = [...history.filter((turn) => turn.role === "user").map((turn) => turn.text), message].join(" ");
  return detectLanguage(guestText);
}

/**
 * Rebuilds an earlier turn in Gemini's own format.
 *
 * An assistant turn that used tools becomes three entries, exactly like a live turn:
 * the model's function calls, the tool results, then the model's reply. Tool results must
 * NOT be written into the history as plain text: the model then imitates that text and
 * "reports" a booking it never made, with an invented reference code.
 */
function toContents(turn: ChatTurn): Content[] {
  if (turn.role === "user") return [{ role: "user", parts: [{ text: turn.text }] }];

  const contents: Content[] = [];
  const calls = turn.toolCalls ?? [];
  if (calls.length > 0) {
    contents.push({
      role: "model",
      parts: calls.map((call, index) => ({
        functionCall: { name: call.name, args: call.args },
        // Only the first call of a step needs a signature.
        ...(index === 0 && { thoughtSignature: REPLAYED_CALL_SIGNATURE }),
      })),
    });
    contents.push({
      role: "user",
      parts: calls.map((call) => ({ functionResponse: { name: call.name, response: call.result } })),
    });
  }
  contents.push({ role: "model", parts: [{ text: turn.text }] });
  return contents;
}

function finish(reply: string, toolCalls: ToolCallRecord[]): AgentReply {
  return { reply, events: eventsFrom(toolCalls), toolCalls };
}

/** Successful bookings and handoffs become cards in the chat UI. */
function eventsFrom(toolCalls: ToolCallRecord[]): ChatEvent[] {
  const events: ChatEvent[] = [];
  for (const { name, result } of toolCalls) {
    if (!result.ok) continue;
    if (name === "create_booking_hold") events.push({ type: "booking_created", booking: result.booking as BookingCard });
    if (name === "handoff_to_staff") events.push({ type: "ticket_created", ticket: result.ticket as TicketCard });
  }
  return events;
}

function fallbackReply(language: Language): string {
  return language === "en"
    ? "Sorry, I couldn't complete that. Could you say it another way, or shall I pass you to the team?"
    : "المعذرة، ما قدرت أكمل طلبك. ممكن توضح أكثر، أو أحولك لفريق الفندق؟";
}
