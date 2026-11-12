import type { Language, Ticket } from "../../shared/types.ts";
import type { HotelRepository } from "../data/repository.ts";

/** Everything a tool needs from the outside world. Nothing is read from globals, so tools are easy to test. */
export interface ToolContext {
  repo: HotelRepository;
  /** When the guest's message arrived. Passed in so tests and evals can freeze time. */
  now: Date;
  /** Chat session the call belongs to; null when a tool is run by hand. */
  sessionId: string | null;
  /** Language of the guest's messages, worked out by detectLanguage(), not reported by the model. */
  language: Language;
  /** The guest message being answered. create_booking_hold uses it to check that the details were read back first. */
  latestGuestMessage?: string;
  /** Called after a handoff ticket is stored. The chat route uses it for the optional n8n webhook. */
  onTicketCreated?: (ticket: Ticket) => void;
  /** Tests replace this to force a reference-code clash. */
  newReferenceCode?: () => string;
}

/**
 * What a tool hands back to the model, as plain JSON.
 * A failure is a normal result, not an exception: `message` tells the model what to do next
 * (fix an argument, ask the guest again, hand off), and it can recover within the same turn.
 */
export type ToolResult = ToolSuccess | ToolFailure;

export type ToolSuccess = { ok: true } & Record<string, unknown>;

export type ToolFailure = { ok: false; error: string; message: string } & Record<string, unknown>;

export type ToolHandler = (rawArgs: unknown, ctx: ToolContext) => Promise<ToolResult>;

export function fail(error: string, message: string, extra: Record<string, unknown> = {}): ToolFailure {
  return { ok: false, error, message, ...extra };
}
