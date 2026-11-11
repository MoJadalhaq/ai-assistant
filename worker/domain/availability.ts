import { addDays, daysBetween } from "./dates.ts";

export interface Stay {
  checkIn: string;
  checkOut: string;
}

/** The part of a booking that matters for availability. */
export interface BookedStay extends Stay {
  rooms: number;
}

/** Bigger parties are a group booking and go to staff. */
export const MAX_ROOMS_PER_BOOKING = 3;

/**
 * The nights a stay occupies: the check-in night up to, but not including, the check-out date.
 * Someone checking out on Saturday does not sleep there Saturday night,
 * so another guest can check in that same Saturday.
 */
export function nightsOfStay(stay: Stay): string[] {
  const nightCount = daysBetween(stay.checkIn, stay.checkOut);
  return Array.from({ length: nightCount }, (_, index) => addDays(stay.checkIn, index));
}

function occupiesNight(booking: Stay, night: string): boolean {
  return booking.checkIn <= night && night < booking.checkOut;
}

/** Rooms taken on one night. Pass only active bookings (hold or confirmed) of one room type. */
export function unitsBookedOnNight(bookings: BookedStay[], night: string): number {
  return bookings
    .filter((booking) => occupiesNight(booking, night))
    .reduce((total, booking) => total + booking.rooms, 0);
}

/**
 * Rooms free for the whole stay, which is the number free on its busiest night.
 *
 * Counting "bookings that overlap the stay" would be wrong: two bookings on different
 * nights both overlap a three-night stay, yet they never need two rooms at the same time.
 */
export function unitsLeftForStay(totalUnits: number, bookings: BookedStay[], stay: Stay): number {
  const bookedPerNight = nightsOfStay(stay).map((night) => unitsBookedOnNight(bookings, night));
  const busiestNight = Math.max(0, ...bookedPerNight);
  return totalUnits - busiestNight;
}

/** How many rooms of a given capacity a party needs. */
export function roomsNeeded(guests: number, capacityPerRoom: number): number {
  return Math.ceil(guests / capacityPerRoom);
}
