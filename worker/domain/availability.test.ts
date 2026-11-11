import { describe, expect, it } from "vitest";
import { nightsOfStay, roomsNeeded, unitsBookedOnNight, unitsLeftForStay } from "./availability.ts";
import type { BookedStay } from "./availability.ts";

function booking(checkIn: string, checkOut: string, rooms = 1): BookedStay {
  return { checkIn, checkOut, rooms };
}

describe("nightsOfStay", () => {
  it("lists the check-in night up to the night before check-out", () => {
    expect(nightsOfStay({ checkIn: "2026-11-12", checkOut: "2026-11-14" })).toEqual(["2026-11-12", "2026-11-13"]);
  });

  it("is a single night for a next-day check-out", () => {
    expect(nightsOfStay({ checkIn: "2026-11-30", checkOut: "2026-12-01" })).toEqual(["2026-11-30"]);
  });
});

describe("unitsBookedOnNight", () => {
  it("counts a booking on its nights but not on its check-out date", () => {
    const bookings = [booking("2026-11-12", "2026-11-14")];
    expect(unitsBookedOnNight(bookings, "2026-11-11")).toBe(0);
    expect(unitsBookedOnNight(bookings, "2026-11-12")).toBe(1);
    expect(unitsBookedOnNight(bookings, "2026-11-13")).toBe(1);
    expect(unitsBookedOnNight(bookings, "2026-11-14")).toBe(0);
  });

  it("adds up the rooms of every booking on that night", () => {
    const bookings = [booking("2026-11-12", "2026-11-14", 2), booking("2026-11-13", "2026-11-15", 1)];
    expect(unitsBookedOnNight(bookings, "2026-11-13")).toBe(3);
  });
});

describe("unitsLeftForStay", () => {
  const stay = { checkIn: "2026-11-12", checkOut: "2026-11-14" }; // Thursday and Friday nights

  it("returns every room when nothing is booked", () => {
    expect(unitsLeftForStay(4, [], stay)).toBe(4);
  });

  it("is limited by the busiest night, not by the number of overlapping bookings", () => {
    // Two bookings overlap the stay, but on different nights. They never need two rooms at once,
    // so with 2 rooms in total, 1 is still free for the whole stay.
    const bookings = [booking("2026-11-12", "2026-11-13"), booking("2026-11-13", "2026-11-14")];
    expect(unitsLeftForStay(2, bookings, stay)).toBe(1);
  });

  it("is sold out when a single night of the stay is full", () => {
    const bookings = [booking("2026-11-13", "2026-11-14"), booking("2026-11-13", "2026-11-15")];
    expect(unitsLeftForStay(2, bookings, stay)).toBe(0);
  });

  it("lets a guest check in on the day another guest checks out", () => {
    const bookings = [booking("2026-11-10", "2026-11-12")];
    expect(unitsLeftForStay(1, bookings, stay)).toBe(1);
  });

  it("lets a guest check out on the day another guest checks in", () => {
    const bookings = [booking("2026-11-14", "2026-11-16")];
    expect(unitsLeftForStay(1, bookings, stay)).toBe(1);
  });

  it("counts every room of a multi-room booking", () => {
    const bookings = [booking("2026-11-12", "2026-11-14", 3)];
    expect(unitsLeftForStay(4, bookings, stay)).toBe(1);
  });
});

describe("roomsNeeded", () => {
  it("rounds up to whole rooms", () => {
    expect(roomsNeeded(1, 2)).toBe(1);
    expect(roomsNeeded(2, 2)).toBe(1);
    expect(roomsNeeded(3, 2)).toBe(2);
    expect(roomsNeeded(5, 5)).toBe(1);
    expect(roomsNeeded(6, 5)).toBe(2);
  });
});
