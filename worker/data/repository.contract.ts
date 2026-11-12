// One set of tests that every HotelRepository must pass.
//
// It runs twice: against MemoryRepository (memory-repository.test.ts) and against the real D1
// database (d1-repository.test.ts). The availability rule is written twice, once in TypeScript
// and once in SQL; running the same tests on both is what keeps the two from drifting apart.

import { beforeEach, describe, expect, it } from "vitest";
import type { Booking } from "../../shared/types.ts";
import { ROOM_TYPES } from "./hotel-kb.ts";
import type { HotelRepository, NewBookingHold, NewTicket } from "./repository.ts";

const CREATED_AT = "2026-11-11T09:00:00.000Z";

// The Executive Suite has only 2 rooms, which makes "nearly full" and "sold out" easy to set up.
const SUITE = "executive-suite";
const SUITE_UNITS = 2;
const THU_TO_SAT = { checkIn: "2026-11-12", checkOut: "2026-11-14" };

function hold(overrides: Partial<NewBookingHold> = {}): NewBookingHold {
  return {
    referenceCode: "SDH-AAAA",
    sessionId: "session-1",
    guestName: "Test Guest",
    phone: "+966500000001",
    roomCode: SUITE,
    ...THU_TO_SAT,
    nights: 2,
    guests: 2,
    rooms: 1,
    totalHalalas: 276_000,
    notes: null,
    language: "en",
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function existingBooking(overrides: Partial<Omit<Booking, "id">>): Omit<Booking, "id"> {
  return { ...hold(), status: "confirmed", ...overrides };
}

function ticket(overrides: Partial<NewTicket> = {}): NewTicket {
  return {
    sessionId: "session-1",
    reason: "complaint",
    urgency: "high",
    summaryEn: "Room is too noisy.",
    summaryAr: "الغرفة مزعجة.",
    guestName: "Test Guest",
    phone: "+966500000001",
    bookingReference: null,
    language: "en",
    createdAt: CREATED_AT,
    ...overrides,
  };
}

export function describeRepositoryContract(name: string, createRepository: () => HotelRepository): void {
  describe(`${name}: repository contract`, () => {
    let repo: HotelRepository;

    async function unitsLeft(roomCode: string, stay = THU_TO_SAT): Promise<number | undefined> {
      const availability = await repo.listAvailability(stay);
      return availability.find((entry) => entry.room.code === roomCode)?.unitsLeft;
    }

    beforeEach(async () => {
      repo = createRepository();
      await repo.replaceAllData({ rooms: ROOM_TYPES, bookings: [], tickets: [] });
    });

    describe("rooms", () => {
      it("lists every room type, cheapest first", async () => {
        const rooms = await repo.listRooms();
        expect(rooms.map((room) => room.code)).toEqual(["standard-city", "deluxe-sea", "family-room", "executive-suite"]);
        expect(rooms[0]).toEqual(ROOM_TYPES.find((room) => room.code === "standard-city"));
      });
    });

    describe("availability", () => {
      it("shows every room as free when nothing is booked", async () => {
        const availability = await repo.listAvailability(THU_TO_SAT);
        expect(availability.map((entry) => [entry.room.code, entry.unitsLeft])).toEqual([
          ["standard-city", 8],
          ["deluxe-sea", 6],
          ["family-room", 4],
          ["executive-suite", 2],
        ]);
      });

      it("is limited by the busiest night, not by how many bookings overlap the stay", async () => {
        await repo.replaceAllData({
          rooms: ROOM_TYPES,
          bookings: [
            existingBooking({ referenceCode: "SDH-AAA2", checkIn: "2026-11-12", checkOut: "2026-11-13", nights: 1 }),
            existingBooking({ referenceCode: "SDH-AAA3", checkIn: "2026-11-13", checkOut: "2026-11-14", nights: 1 }),
          ],
          tickets: [],
        });
        expect(await unitsLeft(SUITE)).toBe(1);
      });

      it("frees the room on the check-out date", async () => {
        await repo.replaceAllData({
          rooms: ROOM_TYPES,
          bookings: [
            existingBooking({ referenceCode: "SDH-AAA2", checkIn: "2026-11-10", checkOut: "2026-11-12" }),
            existingBooking({ referenceCode: "SDH-AAA3", checkIn: "2026-11-14", checkOut: "2026-11-16" }),
          ],
          tickets: [],
        });
        expect(await unitsLeft(SUITE)).toBe(SUITE_UNITS);
      });

      it("ignores cancelled bookings and counts holds", async () => {
        await repo.replaceAllData({
          rooms: ROOM_TYPES,
          bookings: [
            existingBooking({ referenceCode: "SDH-AAA2", status: "cancelled" }),
            existingBooking({ referenceCode: "SDH-AAA3", status: "hold" }),
          ],
          tickets: [],
        });
        expect(await unitsLeft(SUITE)).toBe(1);
      });

      it("counts every room of a multi-room booking", async () => {
        await repo.replaceAllData({
          rooms: ROOM_TYPES,
          bookings: [existingBooking({ referenceCode: "SDH-AAA2", roomCode: "family-room", rooms: 3, guests: 12 })],
          tickets: [],
        });
        expect(await unitsLeft("family-room")).toBe(1);
      });

      it("keeps room types separate", async () => {
        await repo.replaceAllData({
          rooms: ROOM_TYPES,
          bookings: [existingBooking({ referenceCode: "SDH-AAA2" })],
          tickets: [],
        });
        expect(await unitsLeft(SUITE)).toBe(1);
        expect(await unitsLeft("deluxe-sea")).toBe(6);
      });
    });

    describe("booking holds", () => {
      it("stores a hold and returns it with an id", async () => {
        const result = await repo.createBookingHold(hold({ notes: "Late arrival", language: "mixed" }));

        expect(result.status).toBe("created");
        const [stored] = await repo.listBookings();
        expect(stored).toMatchObject({
          referenceCode: "SDH-AAAA",
          status: "hold",
          roomCode: SUITE,
          checkIn: "2026-11-12",
          checkOut: "2026-11-14",
          rooms: 1,
          totalHalalas: 276_000,
          notes: "Late arrival",
          language: "mixed",
          sessionId: "session-1",
        });
        expect(result).toEqual({ status: "created", booking: stored });
      });

      it("takes the room out of availability", async () => {
        await repo.createBookingHold(hold());
        expect(await unitsLeft(SUITE)).toBe(1);
      });

      it("refuses a hold when no room is left", async () => {
        await repo.createBookingHold(hold({ referenceCode: "SDH-AAA2" }));
        await repo.createBookingHold(hold({ referenceCode: "SDH-AAA3" }));

        const third = await repo.createBookingHold(hold({ referenceCode: "SDH-AAA4" }));

        expect(third).toEqual({ status: "sold_out" });
        expect(await repo.listBookings()).toHaveLength(2);
      });

      it("refuses a hold that needs more rooms than are left", async () => {
        await repo.createBookingHold(hold({ referenceCode: "SDH-AAA2" }));
        const result = await repo.createBookingHold(hold({ referenceCode: "SDH-AAA3", rooms: 2, guests: 6 }));
        expect(result).toEqual({ status: "sold_out" });
      });

      it("gives the last room to exactly one of several guests booking at the same moment", async () => {
        await repo.createBookingHold(hold({ referenceCode: "SDH-AAA2" })); // one suite left

        const results = await Promise.all([
          repo.createBookingHold(hold({ referenceCode: "SDH-BBB2" })),
          repo.createBookingHold(hold({ referenceCode: "SDH-BBB3" })),
          repo.createBookingHold(hold({ referenceCode: "SDH-BBB4" })),
        ]);

        expect(results.filter((result) => result.status === "created")).toHaveLength(1);
        expect(results.filter((result) => result.status === "sold_out")).toHaveLength(2);
        expect(await unitsLeft(SUITE)).toBe(0);
      });

      it("reports a reference code that is already in use", async () => {
        await repo.createBookingHold(hold({ referenceCode: "SDH-AAA2" }));
        const result = await repo.createBookingHold(hold({ referenceCode: "SDH-AAA2", roomCode: "deluxe-sea" }));
        expect(result).toEqual({ status: "reference_taken" });
      });

      it("lists bookings newest first", async () => {
        await repo.createBookingHold(hold({ referenceCode: "SDH-AAA2", roomCode: "standard-city" }));
        await repo.createBookingHold(hold({ referenceCode: "SDH-AAA3", roomCode: "standard-city" }));
        const bookings = await repo.listBookings();
        expect(bookings.map((booking) => booking.referenceCode)).toEqual(["SDH-AAA3", "SDH-AAA2"]);
      });
    });

    describe("tickets", () => {
      it("stores a ticket as open", async () => {
        const created = await repo.createTicket(ticket({ bookingReference: "SDH-AAAA" }));

        expect(created).toMatchObject({ status: "open", resolvedAt: null, reason: "complaint", urgency: "high" });
        const [stored] = await repo.listTickets();
        expect(stored).toEqual(created);
        expect(stored?.summaryAr).toBe("الغرفة مزعجة.");
      });

      it("accepts a ticket with no guest details", async () => {
        const created = await repo.createTicket(ticket({ guestName: null, phone: null, sessionId: null }));
        expect(created.guestName).toBeNull();
        expect(await repo.listTickets()).toHaveLength(1);
      });

      it("lists tickets newest first", async () => {
        const first = await repo.createTicket(ticket({ summaryEn: "first" }));
        const second = await repo.createTicket(ticket({ summaryEn: "second" }));
        const tickets = await repo.listTickets();
        expect(tickets.map((entry) => entry.id)).toEqual([second.id, first.id]);
      });

      it("resolves a ticket and keeps the time of the first resolve", async () => {
        const created = await repo.createTicket(ticket());

        const resolved = await repo.resolveTicket(created.id, "2026-11-11T10:00:00.000Z");
        const again = await repo.resolveTicket(created.id, "2026-11-11T11:00:00.000Z");

        expect(resolved).toMatchObject({ id: created.id, status: "resolved", resolvedAt: "2026-11-11T10:00:00.000Z" });
        expect(again?.resolvedAt).toBe("2026-11-11T10:00:00.000Z");
        expect((await repo.listTickets())[0]?.status).toBe("resolved");
      });

      it("returns null when resolving a ticket that doesn't exist", async () => {
        expect(await repo.resolveTicket(999, CREATED_AT)).toBeNull();
      });
    });

    describe("replaceAllData", () => {
      it("removes everything that was there before", async () => {
        await repo.createBookingHold(hold());
        await repo.createTicket(ticket());

        await repo.replaceAllData({ rooms: ROOM_TYPES, bookings: [], tickets: [] });

        expect(await repo.listBookings()).toEqual([]);
        expect(await repo.listTickets()).toEqual([]);
        expect(await repo.listRooms()).toHaveLength(ROOM_TYPES.length);
      });
    });
  });
}
