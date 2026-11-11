// The /api/chat contract between the browser and the Worker.

/** One message in the conversation the browser keeps and sends back each time (the server stores no chat state). */
export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  /**
   * Assistant turns only: the tools called in that turn and what they returned.
   * Sent back so the model remembers what it offered ("the deluxe room is SAR 1,380").
   * Never shown to the guest.
   */
  toolCalls?: ToolCallSummary[];
}

export interface ToolCallSummary {
  name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface ChatRequest {
  sessionId: string;
  message: string;
  history: ChatTurn[];
}

/** What the booking card shows. Same fields create_booking_hold returns to the model. */
export interface BookingCard {
  reference_code: string;
  status: string;
  room_type: string;
  room_name_en: string;
  room_name_ar: string;
  rooms: number;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  total_sar: number;
  vat_included_sar: number;
  guest_name: string;
  phone: string;
}

export interface TicketCard {
  id: number;
  reason: string;
  urgency: string;
  status: string;
}

/** Things that happened during the turn, shown as cards under the reply. */
export type ChatEvent = { type: "booking_created"; booking: BookingCard } | { type: "ticket_created"; ticket: TicketCard };

export interface ChatSuccess {
  ok: true;
  reply: string;
  events: ChatEvent[];
  toolCalls: ToolCallSummary[];
}

export type ChatErrorCode = "invalid_request" | "rate_limited" | "model_busy" | "not_configured" | "internal_error";

export interface ChatFailure {
  ok: false;
  error: ChatErrorCode;
  /** Present on 429s, so the UI can say "try again in a minute". */
  retryAfterSeconds?: number;
  problems?: string[];
}

export type ChatResponse = ChatSuccess | ChatFailure;
