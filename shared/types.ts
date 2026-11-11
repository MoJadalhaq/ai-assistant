// Data shapes used by both the Worker and the browser.
// Field names are camelCase here; the D1 columns are snake_case and are mapped in d1-repository.ts.

/** Which language the guest is writing in. "mixed" = Arabic and English in the same conversation. */
export type Language = "ar" | "en" | "mixed";

export type BookingStatus = "hold" | "confirmed" | "cancelled";
export type Urgency = "low" | "normal" | "high";
export type TicketStatus = "open" | "resolved";

export const URGENCIES = ["low", "normal", "high"] as const satisfies readonly Urgency[];

/** Why a conversation was handed to a human. A fixed list so staff can filter and the evals can assert on it. */
export const HANDOFF_REASONS = [
  "human_request",
  "complaint",
  "out_of_scope",
  "group_booking",
  "special_pricing",
  "medical_or_accessibility",
  "other",
] as const;
export type HandoffReason = (typeof HANDOFF_REASONS)[number];

export interface Room {
  /** Stable id such as "deluxe-sea". This is what the model passes to tools as room_type. */
  code: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  /** Most guests one room can take, children included. */
  capacity: number;
  /** Price per night for one room, VAT included, in halalas (1 SAR = 100 halalas). */
  nightlyRateHalalas: number;
  /** How many rooms of this type the hotel has. */
  totalUnits: number;
}

export interface Booking {
  id: number;
  /** What the guest is given, e.g. "SDH-7K3Q". */
  referenceCode: string;
  /** Chat session that created it; null for seeded sample data. */
  sessionId: string | null;
  guestName: string;
  phone: string;
  roomCode: string;
  /** Dates are 'YYYY-MM-DD' in Riyadh time. The guest sleeps the nights from checkIn up to, not including, checkOut. */
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  /** Number of rooms of this type held by the booking (1 to 3). */
  rooms: number;
  /** Price for the whole stay at the moment of booking, so later price changes don't rewrite history. */
  totalHalalas: number;
  notes: string | null;
  status: BookingStatus;
  language: Language;
  /** UTC timestamp, ISO 8601. */
  createdAt: string;
}

export interface Ticket {
  id: number;
  sessionId: string | null;
  reason: HandoffReason;
  urgency: Urgency;
  /** Short summaries in both languages, so any staff member can act without reading the chat. */
  summaryEn: string;
  summaryAr: string;
  guestName: string | null;
  phone: string | null;
  bookingReference: string | null;
  language: Language;
  status: TicketStatus;
  createdAt: string;
  resolvedAt: string | null;
}
