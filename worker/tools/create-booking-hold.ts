import type { Booking, Room } from "../../shared/types.ts";
import { MAX_ROOMS_PER_BOOKING, roomsNeeded } from "../domain/availability.ts";
import { daysBetween, findStayProblem, riyadhToday } from "../domain/dates.ts";
import { normalizePhone } from "../domain/phone.ts";
import { halalasToSar, stayTotalHalalas, vatIncludedHalalas } from "../domain/pricing.ts";
import { generateReferenceCode } from "../domain/reference-code.ts";
import { ArgReader, invalidArguments } from "./args.ts";
import { groupBookingFailure, MAX_PARTY_SIZE, stayProblemFailure, unknownRoomTypeFailure } from "./shared-failures.ts";
import { fail } from "./tool-types.ts";
import type { ToolContext, ToolResult } from "./tool-types.ts";

// A clash needs two random codes out of about 900,000 to match, so one retry is almost always enough.
const MAX_REFERENCE_ATTEMPTS = 3;

/**
 * create_booking_hold(name, phone, room_type, check_in, check_out, guests, guest_confirmed, rooms?, notes?)
 *
 * Holds the room(s) and returns a reference code. No payment is involved.
 * Every rule is checked again here, even though check_availability ran earlier:
 * the model may skip that step, and another guest may have booked in the meantime.
 */
export async function createBookingHold(rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
  const args = new ArgReader(rawArgs);
  const guestName = args.string("name", 80);
  const rawPhone = args.string("phone", 30);
  const roomType = args.string("room_type", 40);
  const checkIn = args.date("check_in");
  const checkOut = args.date("check_out");
  const guests = args.integer("guests", 1, MAX_PARTY_SIZE);
  const guestConfirmed = args.boolean("guest_confirmed");
  const requestedRooms = args.optionalInteger("rooms", 1, MAX_ROOMS_PER_BOOKING);
  const notes = args.optionalString("notes", 300);
  if (args.problems.length > 0) return invalidArguments(args.problems);

  // The model has to state that the guest said yes. Having to set this flag makes it
  // stop and read the details back first, instead of booking on the first mention of a room.
  if (!guestConfirmed) {
    return fail(
      "not_confirmed",
      "Read the details back to the guest (room type, dates, nights, guests, total price, name, phone) and wait for a clear yes. Then call this tool again with guest_confirmed set to true.",
    );
  }

  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return fail(
      "invalid_phone",
      "That phone number is not valid. Ask the guest to give it again. A Saudi mobile has 10 digits and starts with 05; a number from another country needs its country code.",
    );
  }

  const today = riyadhToday(ctx.now);
  const stayProblem = findStayProblem(checkIn, checkOut, today);
  if (stayProblem) return stayProblemFailure(stayProblem, today);

  const allRooms = await ctx.repo.listRooms();
  const room = allRooms.find((candidate) => candidate.code === roomType);
  if (!room) {
    return unknownRoomTypeFailure(
      roomType,
      allRooms.map((candidate) => candidate.code),
    );
  }

  const rooms = requestedRooms ?? roomsNeeded(guests, room.capacity);
  if (rooms > MAX_ROOMS_PER_BOOKING) return groupBookingFailure();
  if (guests > room.capacity * rooms) {
    return fail(
      "too_many_guests",
      `${rooms} x ${room.nameEn} takes at most ${room.capacity * rooms} guests, and this party has ${guests}. Call check_availability again to find what fits.`,
    );
  }

  const nights = daysBetween(checkIn, checkOut);
  const newReferenceCode = ctx.newReferenceCode ?? generateReferenceCode;

  for (let attempt = 1; attempt <= MAX_REFERENCE_ATTEMPTS; attempt++) {
    const result = await ctx.repo.createBookingHold({
      referenceCode: newReferenceCode(),
      sessionId: ctx.sessionId,
      guestName,
      phone,
      roomCode: room.code,
      checkIn,
      checkOut,
      nights,
      guests,
      rooms,
      totalHalalas: stayTotalHalalas(room.nightlyRateHalalas, nights, rooms),
      notes,
      language: ctx.language,
      createdAt: ctx.now.toISOString(),
    });

    if (result.status === "created") return holdCreated(result.booking, room);
    if (result.status === "sold_out") {
      return fail(
        "sold_out",
        "This room type is no longer free for these dates. Apologize, call check_availability again and offer the guest what is left.",
      );
    }
    // "reference_taken": go round again with a new random code.
  }

  throw new Error(`No unique booking reference after ${MAX_REFERENCE_ATTEMPTS} attempts`);
}

function holdCreated(booking: Booking, room: Room): ToolResult {
  return {
    ok: true,
    booking: {
      reference_code: booking.referenceCode,
      status: booking.status,
      room_type: room.code,
      room_name_en: room.nameEn,
      room_name_ar: room.nameAr,
      rooms: booking.rooms,
      check_in: booking.checkIn,
      check_out: booking.checkOut,
      nights: booking.nights,
      guests: booking.guests,
      total_sar: halalasToSar(booking.totalHalalas),
      vat_included_sar: halalasToSar(vatIncludedHalalas(booking.totalHalalas)),
      guest_name: booking.guestName,
      phone: booking.phone,
    },
    note: "The room is held. Give the guest the reference code. This is a hold, not a confirmed booking: no payment was taken and the reservations team will contact the guest to confirm.",
  };
}
