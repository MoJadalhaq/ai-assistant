// The /api contract between the browser and the Worker: the guest chat and the staff dashboard.

import type { Booking, Ticket } from "./types.ts";

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

export type ChatErrorCode =
  | "invalid_request"
  | "rate_limited" // this visitor sent too many messages in the last minute
  | "daily_limit" // this visitor used their messages for today
  | "demo_quota_used" // the whole demo used its budget for today
  | "model_busy" // Gemini is overloaded or out of quota
  | "not_configured"
  | "internal_error";

export interface ChatFailure {
  ok: false;
  error: ChatErrorCode;
  /** Present on 429s, so the UI can say "try again in a minute". */
  retryAfterSeconds?: number;
  problems?: string[];
}

export type ChatResponse = ChatSuccess | ChatFailure;

// ---- Staff dashboard (/api/staff) ----

/** A booking as the dashboard sees it: no chat session id, and the phone number partly hidden. */
export interface StaffBooking extends Omit<Booking, "sessionId"> {
  /** True when a guest made it through the chat; false for the seeded sample bookings. */
  fromChat: boolean;
}

export interface StaffTicket extends Omit<Ticket, "sessionId"> {
  fromChat: boolean;
}

export interface StaffRoomName {
  code: string;
  nameEn: string;
  nameAr: string;
}

export interface StaffOverview {
  ok: true;
  /** Today in Riyadh, 'YYYY-MM-DD'. */
  today: string;
  rooms: StaffRoomName[];
  /** Newest first, at most 100 of each. */
  bookings: StaffBooking[];
  tickets: StaffTicket[];
}

export interface ResolveTicketSuccess {
  ok: true;
  ticket: StaffTicket;
}

export interface ResetDemoSuccess {
  ok: true;
  today: string;
}

export type StaffErrorCode = "rate_limited" | "not_found" | "invalid_request" | "internal_error";

export interface StaffFailure {
  ok: false;
  error: StaffErrorCode;
  retryAfterSeconds?: number;
}
