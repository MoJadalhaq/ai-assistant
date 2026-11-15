// The chat behind a handoff ticket, for the staff dashboard.
//
// Every chat turn is logged to the `conversations` table by routes/chat.ts: the guest's message,
// the tool calls (as one JSON row), and the reply. A ticket remembers its chat session, so staff
// can read what led to the handoff instead of asking the guest to repeat themselves.

import type { TranscriptMessage } from "../../shared/api-types.ts";
import { maskPhonesInText } from "../domain/phone.ts";

/** The most recent messages shown; a demo chat never gets near this. */
const MAX_ROWS = 200;

interface ConversationRow {
  role: "user" | "assistant" | "tool";
  content: string;
  created_at: string;
}

/**
 * The conversation for a ticket, oldest first. Null when there is no such ticket; an empty list for
 * a ticket that didn't come from a chat (the seeded samples) or whose chat wasn't saved.
 */
export async function readTicketConversation(db: D1Database, ticketId: number): Promise<TranscriptMessage[] | null> {
  const ticket = await db.prepare("SELECT session_id FROM tickets WHERE id = ?").bind(ticketId).first<{ session_id: string | null }>();
  if (!ticket) return null;
  if (ticket.session_id === null) return [];

  // Newest rows first so the limit keeps the end of a long chat, then put back in order.
  const { results } = await db
    .prepare("SELECT role, content, created_at FROM conversations WHERE session_id = ? ORDER BY id DESC LIMIT ?")
    .bind(ticket.session_id, MAX_ROWS)
    .all<ConversationRow>();
  return buildTranscript(results.reverse());
}

/**
 * Turns logged rows into messages for the dashboard. A tool row becomes the list of tool names
 * on the reply that follows it; the arguments are left out because they contain guest details.
 * Phone numbers in the text are masked, since the demo dashboard is public.
 */
export function buildTranscript(rows: ConversationRow[]): TranscriptMessage[] {
  const messages: TranscriptMessage[] = [];
  let pendingTools: string[] = [];

  for (const row of rows) {
    if (row.role === "tool") {
      pendingTools = toolNames(row.content);
      continue;
    }
    messages.push({
      role: row.role === "user" ? "guest" : "assistant",
      text: maskPhonesInText(row.content),
      at: row.created_at,
      tools: row.role === "assistant" ? pendingTools : [],
    });
    if (row.role === "assistant") pendingTools = [];
  }
  return messages;
}

function toolNames(json: string): string[] {
  try {
    const calls: unknown = JSON.parse(json);
    if (!Array.isArray(calls)) return [];
    return calls.flatMap((call) => (typeof call?.name === "string" ? [call.name as string] : []));
  } catch {
    return [];
  }
}
