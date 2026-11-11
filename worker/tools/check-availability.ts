import { MAX_ROOMS_PER_BOOKING, roomsNeeded } from "../domain/availability.ts";
import { daysBetween, findStayProblem, riyadhToday } from "../domain/dates.ts";
import { halalasToSar, stayTotalHalalas, vatIncludedHalalas } from "../domain/pricing.ts";
import { ArgReader, invalidArguments } from "./args.ts";
import { groupBookingFailure, MAX_PARTY_SIZE, stayProblemFailure, unknownRoomTypeFailure } from "./shared-failures.ts";
import type { ToolContext, ToolResult } from "./tool-types.ts";

/**
 * check_availability(check_in, check_out, guests, room_type?)
 *
 * Returns the room types that can take the party for those dates, each with the number of rooms
 * needed and the total price. The assistant quotes prices from this result only.
 */
export async function checkAvailability(rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
  const args = new ArgReader(rawArgs);
  const checkIn = args.date("check_in");
  const checkOut = args.date("check_out");
  const guests = args.integer("guests", 1, MAX_PARTY_SIZE);
  const roomType = args.optionalString("room_type", 40);
  if (args.problems.length > 0) return invalidArguments(args.problems);

  const today = riyadhToday(ctx.now);
  const stayProblem = findStayProblem(checkIn, checkOut, today);
  if (stayProblem) return stayProblemFailure(stayProblem, today);

  const allRoomTypes = await ctx.repo.listAvailability({ checkIn, checkOut });

  // A party that would need more than 3 rooms of even the largest room type is a group booking.
  // The rule lives here, in code, so it holds no matter how the model reads its instructions.
  const isGroup = allRoomTypes.every(({ room }) => roomsNeeded(guests, room.capacity) > MAX_ROOMS_PER_BOOKING);
  if (isGroup) return groupBookingFailure();

  const considered = roomType ? allRoomTypes.filter(({ room }) => room.code === roomType) : allRoomTypes;
  if (roomType && considered.length === 0) {
    return unknownRoomTypeFailure(
      roomType,
      allRoomTypes.map(({ room }) => room.code),
    );
  }

  const nights = daysBetween(checkIn, checkOut);
  const options = [];
  const notAvailable = [];

  for (const { room, unitsLeft } of considered) {
    const rooms = roomsNeeded(guests, room.capacity);
    const names = { room_type: room.code, name_en: room.nameEn, name_ar: room.nameAr };

    if (rooms > MAX_ROOMS_PER_BOOKING) {
      notAvailable.push({ ...names, reason: "party_too_large_for_this_room_type" });
    } else if (unitsLeft < rooms) {
      notAvailable.push({ ...names, reason: "sold_out", rooms_needed: rooms, rooms_left: unitsLeft });
    } else {
      const totalHalalas = stayTotalHalalas(room.nightlyRateHalalas, nights, rooms);
      options.push({
        ...names,
        rooms_needed: rooms,
        max_guests_per_room: room.capacity,
        rooms_left: unitsLeft,
        price_per_night_sar: halalasToSar(room.nightlyRateHalalas),
        total_sar: halalasToSar(totalHalalas),
        vat_included_sar: halalasToSar(vatIncludedHalalas(totalHalalas)),
      });
    }
  }

  options.sort((a, b) => a.total_sar - b.total_sar);

  return {
    ok: true,
    check_in: checkIn,
    check_out: checkOut,
    nights,
    guests,
    currency: "SAR",
    prices_include_vat: true,
    options,
    not_available: notAvailable,
    ...(options.length === 0 && { note: nothingFreeNote(roomType !== null) }),
  };
}

function nothingFreeNote(askedForOneRoomType: boolean): string {
  return askedForOneRoomType
    ? "That room type is not free for these dates. Call check_availability again without room_type to see the other room types."
    : "Nothing is free for these dates. Offer the guest different dates.";
}
