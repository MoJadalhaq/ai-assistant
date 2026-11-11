import type {
  Booking,
  BookingStatus,
  HandoffReason,
  Language,
  Room,
  Ticket,
  TicketStatus,
  Urgency,
} from "../../shared/types.ts";
import type { Stay } from "../domain/availability.ts";
import type {
  CreateHoldResult,
  HotelRepository,
  NewBookingHold,
  NewTicket,
  RoomAvailability,
  SeedData,
} from "./repository.ts";

// ---------------------------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------------------------

// A small generated table with one row per night of the requested stay.
// ?1 is the check-in date and ?2 the check-out date. The check-out date itself is not a night.
// Example: check-in 2026-11-12, check-out 2026-11-14 gives the rows 2026-11-12 and 2026-11-13.
const NIGHTS_OF_STAY = `
  nights(night) AS (
    SELECT ?1
    UNION ALL
    SELECT date(night, '+1 day') FROM nights WHERE date(night, '+1 day') < ?2
  )`;

// A booking takes up a room on a night when it has checked in by then and has not checked out yet.
// Cancelled bookings don't count.
const BOOKING_OCCUPIES_NIGHT = `
  b.status IN ('hold', 'confirmed') AND b.check_in <= n.night AND b.check_out > n.night`;

// For every room type: rooms left = total rooms minus the rooms booked on the busiest night.
const AVAILABILITY_SQL = `
  WITH RECURSIVE ${NIGHTS_OF_STAY},
  booked(room_code, night, units) AS (
    SELECT r.code, n.night, COALESCE(SUM(b.rooms), 0)
    FROM rooms r
    CROSS JOIN nights n
    LEFT JOIN bookings b ON b.room_code = r.code AND ${BOOKING_OCCUPIES_NIGHT}
    GROUP BY r.code, n.night
  )
  SELECT r.*, r.total_units - MAX(booked.units) AS units_left
  FROM rooms r
  JOIN booked ON booked.room_code = r.code
  GROUP BY r.code
  ORDER BY r.nightly_rate_halalas`;

// Check and insert in ONE statement.
//
// If we first asked "is a room free?" and then inserted, two guests booking the last room at the
// same moment could both get "yes" before either insert ran. SQLite runs a single statement as one
// indivisible step, so here the availability check (the WHERE at the bottom) and the INSERT cannot
// be separated. When no room is left, the SELECT returns no row and nothing is inserted.
const CREATE_HOLD_SQL = `
  WITH RECURSIVE ${NIGHTS_OF_STAY},
  booked(night, units) AS (
    SELECT n.night, COALESCE(SUM(b.rooms), 0)
    FROM nights n
    LEFT JOIN bookings b ON b.room_code = ?3 AND ${BOOKING_OCCUPIES_NIGHT}
    GROUP BY n.night
  )
  INSERT INTO bookings (
    check_in, check_out, room_code, reference_code, session_id, guest_name, phone,
    nights, guests, rooms, total_halalas, notes, language, created_at, status
  )
  SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 'hold'
  FROM rooms r
  WHERE r.code = ?3
    AND r.total_units - (SELECT MAX(units) FROM booked) >= ?10`;

const INSERT_ROOM_SQL = `
  INSERT INTO rooms (code, name_en, name_ar, description_en, description_ar, capacity, nightly_rate_halalas, total_units)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

const INSERT_BOOKING_SQL = `
  INSERT INTO bookings (
    reference_code, session_id, guest_name, phone, room_code, check_in, check_out,
    nights, guests, rooms, total_halalas, notes, status, language, created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const INSERT_TICKET_SQL = `
  INSERT INTO tickets (
    session_id, reason, urgency, summary_en, summary_ar, guest_name, phone,
    booking_reference, language, status, created_at, resolved_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// ---------------------------------------------------------------------------------------------
// Rows as D1 returns them (snake_case), and their conversion to the app's types (camelCase)
// ---------------------------------------------------------------------------------------------

interface RoomRow {
  code: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  capacity: number;
  nightly_rate_halalas: number;
  total_units: number;
}

interface BookingRow {
  id: number;
  reference_code: string;
  session_id: string | null;
  guest_name: string;
  phone: string;
  room_code: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  rooms: number;
  total_halalas: number;
  notes: string | null;
  status: BookingStatus;
  language: Language;
  created_at: string;
}

interface TicketRow {
  id: number;
  session_id: string | null;
  reason: HandoffReason;
  urgency: Urgency;
  summary_en: string;
  summary_ar: string;
  guest_name: string | null;
  phone: string | null;
  booking_reference: string | null;
  language: Language;
  status: TicketStatus;
  created_at: string;
  resolved_at: string | null;
}

function toRoom(row: RoomRow): Room {
  return {
    code: row.code,
    nameEn: row.name_en,
    nameAr: row.name_ar,
    descriptionEn: row.description_en,
    descriptionAr: row.description_ar,
    capacity: row.capacity,
    nightlyRateHalalas: row.nightly_rate_halalas,
    totalUnits: row.total_units,
  };
}

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    referenceCode: row.reference_code,
    sessionId: row.session_id,
    guestName: row.guest_name,
    phone: row.phone,
    roomCode: row.room_code,
    checkIn: row.check_in,
    checkOut: row.check_out,
    nights: row.nights,
    guests: row.guests,
    rooms: row.rooms,
    totalHalalas: row.total_halalas,
    notes: row.notes,
    status: row.status,
    language: row.language,
    createdAt: row.created_at,
  };
}

function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    sessionId: row.session_id,
    reason: row.reason,
    urgency: row.urgency,
    summaryEn: row.summary_en,
    summaryAr: row.summary_ar,
    guestName: row.guest_name,
    phone: row.phone,
    bookingReference: row.booking_reference,
    language: row.language,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

// ---------------------------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------------------------

export class D1Repository implements HotelRepository {
  private readonly db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async listRooms(): Promise<Room[]> {
    const { results } = await this.db.prepare("SELECT * FROM rooms ORDER BY nightly_rate_halalas").all<RoomRow>();
    return results.map(toRoom);
  }

  async listAvailability(stay: Stay): Promise<RoomAvailability[]> {
    const { results } = await this.db
      .prepare(AVAILABILITY_SQL)
      .bind(stay.checkIn, stay.checkOut)
      .all<RoomRow & { units_left: number }>();
    return results.map((row) => ({ room: toRoom(row), unitsLeft: row.units_left }));
  }

  async createBookingHold(hold: NewBookingHold): Promise<CreateHoldResult> {
    const statement = this.db.prepare(CREATE_HOLD_SQL).bind(
      hold.checkIn, // ?1
      hold.checkOut, // ?2
      hold.roomCode, // ?3
      hold.referenceCode, // ?4
      hold.sessionId, // ?5
      hold.guestName, // ?6
      hold.phone, // ?7
      hold.nights, // ?8
      hold.guests, // ?9
      hold.rooms, // ?10
      hold.totalHalalas, // ?11
      hold.notes, // ?12
      hold.language, // ?13
      hold.createdAt, // ?14
    );

    try {
      const { meta } = await statement.run();
      // No row inserted means the availability check inside the statement said no.
      if (meta.changes === 0) return { status: "sold_out" };
      return { status: "created", booking: { ...hold, id: meta.last_row_id, status: "hold" } };
    } catch (error) {
      if (isDuplicateReference(error)) return { status: "reference_taken" };
      throw error;
    }
  }

  async createTicket(ticket: NewTicket): Promise<Ticket> {
    const { meta } = await this.db
      .prepare(INSERT_TICKET_SQL)
      .bind(...ticketValues({ ...ticket, status: "open", resolvedAt: null }))
      .run();
    return { ...ticket, id: meta.last_row_id, status: "open", resolvedAt: null };
  }

  async listBookings(): Promise<Booking[]> {
    const { results } = await this.db.prepare("SELECT * FROM bookings ORDER BY id DESC").all<BookingRow>();
    return results.map(toBooking);
  }

  async listTickets(): Promise<Ticket[]> {
    const { results } = await this.db.prepare("SELECT * FROM tickets ORDER BY id DESC").all<TicketRow>();
    return results.map(toTicket);
  }

  async replaceAllData(seed: SeedData): Promise<void> {
    // batch() runs all statements as one transaction: either the whole reset happens or none of it,
    // so a failure halfway can't leave the demo with an empty hotel.
    // Bookings are deleted before rooms because bookings point at rooms.
    await this.db.batch([
      this.db.prepare("DELETE FROM conversations"),
      this.db.prepare("DELETE FROM tickets"),
      this.db.prepare("DELETE FROM bookings"),
      this.db.prepare("DELETE FROM rooms"),
      ...seed.rooms.map((room) => this.db.prepare(INSERT_ROOM_SQL).bind(...roomValues(room))),
      ...seed.bookings.map((booking) => this.db.prepare(INSERT_BOOKING_SQL).bind(...bookingValues(booking))),
      ...seed.tickets.map((ticket) => this.db.prepare(INSERT_TICKET_SQL).bind(...ticketValues(ticket))),
    ]);
  }
}

function isDuplicateReference(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed: bookings.reference_code");
}

// The value lists below must stay in the same order as the columns in the INSERT statements above.

function roomValues(room: Room) {
  return [
    room.code,
    room.nameEn,
    room.nameAr,
    room.descriptionEn,
    room.descriptionAr,
    room.capacity,
    room.nightlyRateHalalas,
    room.totalUnits,
  ];
}

function bookingValues(booking: Omit<Booking, "id">) {
  return [
    booking.referenceCode,
    booking.sessionId,
    booking.guestName,
    booking.phone,
    booking.roomCode,
    booking.checkIn,
    booking.checkOut,
    booking.nights,
    booking.guests,
    booking.rooms,
    booking.totalHalalas,
    booking.notes,
    booking.status,
    booking.language,
    booking.createdAt,
  ];
}

function ticketValues(ticket: Omit<Ticket, "id">) {
  return [
    ticket.sessionId,
    ticket.reason,
    ticket.urgency,
    ticket.summaryEn,
    ticket.summaryAr,
    ticket.guestName,
    ticket.phone,
    ticket.bookingReference,
    ticket.language,
    ticket.status,
    ticket.createdAt,
    ticket.resolvedAt,
  ];
}
