// Failure results used by more than one tool.
// Each `message` is written for the model: it says what went wrong and what to do about it.

import { MAX_ROOMS_PER_BOOKING } from "../domain/availability.ts";
import { MAX_DAYS_AHEAD, MAX_NIGHTS_PER_STAY } from "../domain/dates.ts";
import type { StayProblem } from "../domain/dates.ts";
import { fail } from "./tool-types.ts";
import type { ToolFailure } from "./tool-types.ts";

/** Above this, the request is certainly a group. Only a sanity limit on the number itself. */
export const MAX_PARTY_SIZE = 10_000;

export function stayProblemFailure(problem: StayProblem, today: string): ToolFailure {
  const messages: Record<StayProblem, string> = {
    check_in_in_past: `check_in is before today. Today in Riyadh is ${today}. Work the date out again from today, or ask the guest which date they mean.`,
    check_out_not_after_check_in: "check_out must be after check_in. A one-night stay checks out the next day. Ask the guest how many nights they want.",
    stay_too_long: `One booking covers at most ${MAX_NIGHTS_PER_STAY} nights. For a longer stay, call handoff_to_staff with reason "special_pricing".`,
    too_far_ahead: `Bookings open at most ${MAX_DAYS_AHEAD} days ahead. Ask the guest for an earlier date, or hand off to staff.`,
  };
  return fail(problem, messages[problem], { today });
}

export function unknownRoomTypeFailure(roomType: string, validRoomTypes: string[]): ToolFailure {
  return fail("unknown_room_type", `There is no room type "${roomType}". Use one of: ${validRoomTypes.join(", ")}.`, {
    valid_room_types: validRoomTypes,
  });
}

export function groupBookingFailure(): ToolFailure {
  return fail(
    "group_booking",
    `This party needs more than ${MAX_ROOMS_PER_BOOKING} rooms, which is a group booking. Do not quote a price. Call handoff_to_staff with reason "group_booking".`,
  );
}
