import { describe, expect, it } from "vitest";
import { addDays, daysBetween, nextWeekday, THURSDAY } from "../domain/dates.ts";
import { ROOM_TYPES } from "./hotel-kb.ts";
import { MemoryRepository } from "./memory-repository.ts";
import { buildSeedData } from "./seed.ts";

const CREATED_AT = "2026-11-11T09:00:00.000Z";

async function seededRepository(today: string): Promise<MemoryRepository> {
  const repo = new MemoryRepository();
  await repo.replaceAllData(buildSeedData(today, CREATED_AT));
  return repo;
}

async function unitsLeft(repo: MemoryRepository, roomCode: string, checkIn: string, checkOut: string) {
  const availability = await repo.listAvailability({ checkIn, checkOut });
  return availability.find((entry) => entry.room.code === roomCode)?.unitsLeft;
}

// Every day of one week, so the seed is checked from each weekday's point of view.
const ONE_WEEK = Array.from({ length: 7 }, (_, index) => addDays("2026-11-08", index));

describe("buildSeedData", () => {
  it("copies the room types from the knowledge base", () => {
    expect(buildSeedData("2026-11-11", CREATED_AT).rooms).toEqual(ROOM_TYPES);
  });

  it("creates bookings that are consistent with themselves", () => {
    const { bookings } = buildSeedData("2026-11-11", CREATED_AT);

    for (const booking of bookings) {
      const room = ROOM_TYPES.find((candidate) => candidate.code === booking.roomCode);
      expect(room, `${booking.referenceCode} uses a known room type`).toBeDefined();
      expect(booking.nights).toBe(daysBetween(booking.checkIn, booking.checkOut));
      expect(booking.nights).toBeGreaterThan(0);
      expect(booking.guests).toBeLessThanOrEqual(room!.capacity * booking.rooms);
      expect(booking.totalHalalas).toBe(room!.nightlyRateHalalas * booking.nights * booking.rooms);
    }
  });

  it("gives every booking its own reference code", () => {
    const codes = buildSeedData("2026-11-11", CREATED_AT).bookings.map((booking) => booking.referenceCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it.each(ONE_WEEK)("when today is %s: one suite left and no family room for the coming weekend", async (today) => {
    const repo = await seededRepository(today);
    const thursday = nextWeekday(today, THURSDAY);
    const friday = addDays(thursday, 1);
    const saturday = addDays(thursday, 2);

    expect(await unitsLeft(repo, "executive-suite", thursday, saturday)).toBe(1);
    expect(await unitsLeft(repo, "family-room", thursday, saturday)).toBe(0);
    // Thursday night alone still has family rooms: the weekend is sold out because of Friday.
    expect(await unitsLeft(repo, "family-room", thursday, friday)).toBe(2);
  });

  it.each(ONE_WEEK)("when today is %s: no night is overbooked", async (today) => {
    const repo = await seededRepository(today);

    for (let offset = 0; offset < 14; offset++) {
      const night = addDays(today, offset);
      const availability = await repo.listAvailability({ checkIn: night, checkOut: addDays(night, 1) });
      for (const { room, unitsLeft: left } of availability) {
        expect(left, `${room.code} on ${night}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("includes an open and a resolved ticket for the staff dashboard", () => {
    const { tickets } = buildSeedData("2026-11-11", CREATED_AT);
    expect(tickets.map((ticket) => ticket.status).sort()).toEqual(["open", "resolved"]);
  });
});
