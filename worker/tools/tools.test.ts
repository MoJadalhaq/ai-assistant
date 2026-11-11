// Tests for the four tools the assistant can call.
// They use the in-memory repository loaded with the demo data, and a clock frozen on
// Wednesday 11 November 2026, 12:00 in Riyadh. The coming weekend is Thursday 12 to Saturday 14.

import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../data/memory-repository.ts";
import { buildSeedData } from "../data/seed.ts";
import { runTool } from "./index.ts";
import type { ToolContext } from "./index.ts";

const NOW = new Date("2026-11-11T09:00:00Z");
const TODAY = "2026-11-11";
const WEEKEND = { check_in: "2026-11-12", check_out: "2026-11-14" };
// A stretch with no bookings in the demo data.
const QUIET_DATES = { check_in: "2026-11-22", check_out: "2026-11-24" };

let repo: MemoryRepository;
let ctx: ToolContext;

beforeEach(async () => {
  repo = new MemoryRepository();
  await repo.replaceAllData(buildSeedData(TODAY, NOW.toISOString()));
  ctx = { repo, now: NOW, sessionId: "session-1", language: "en" };
});

// Results are plain JSON for the model. In tests it is handier to read them loosely typed.
async function call(tool: string, args: unknown, context: ToolContext = ctx): Promise<any> {
  return runTool(tool, args, context);
}

describe("get_hotel_info", () => {
  it("returns a topic in both languages", async () => {
    const result = await call("get_hotel_info", { topic: "check_in_out" });

    expect(result.ok).toBe(true);
    expect(result.info_en).toContain("3:00 PM");
    expect(result.info_ar).toContain("3:00");
  });

  it("returns room types with prices in riyals", async () => {
    const result = await call("get_hotel_info", { topic: "rooms" });

    expect(result.rooms).toHaveLength(4);
    expect(result.rooms[0]).toMatchObject({
      room_type: "standard-city",
      price_per_night_sar: 460,
      max_guests_per_room: 2,
    });
    expect(result.prices_include_vat).toBe(true);
  });

  it("tells the model to hand off when the topic does not exist", async () => {
    const result = await call("get_hotel_info", { topic: "wedding_halls" });

    expect(result).toMatchObject({ ok: false, error: "unknown_topic" });
    expect(result.message).toContain("out_of_scope");
    expect(result.topics).toContain("breakfast");
  });

  it("asks for the topic when it is missing", async () => {
    const result = await call("get_hotel_info", {});
    expect(result).toMatchObject({ ok: false, error: "invalid_arguments" });
  });
});

describe("check_availability", () => {
  it("lists what is free for the weekend, cheapest first, with totals", async () => {
    const result = await call("check_availability", { ...WEEKEND, guests: 2 });

    expect(result).toMatchObject({ ok: true, nights: 2, guests: 2, currency: "SAR", prices_include_vat: true });
    expect(result.options.map((option: { room_type: string }) => option.room_type)).toEqual([
      "standard-city",
      "deluxe-sea",
      "executive-suite",
    ]);
    expect(result.options[0]).toMatchObject({
      rooms_needed: 1,
      price_per_night_sar: 460,
      total_sar: 920,
      vat_included_sar: 120,
    });
    expect(result.options[2]).toMatchObject({ room_type: "executive-suite", rooms_left: 1, total_sar: 2760 });
  });

  it("reports the sold-out room type separately", async () => {
    const result = await call("check_availability", { ...WEEKEND, guests: 2 });
    expect(result.not_available).toEqual([
      { room_type: "family-room", name_en: "Family Room", name_ar: "غرفة عائلية", reason: "sold_out", rooms_needed: 1, rooms_left: 0 },
    ]);
  });

  it("accepts Arabic digits in dates and numbers", async () => {
    const result = await call("check_availability", { check_in: "٢٠٢٦-١١-١٢", check_out: "٢٠٢٦-١١-١٤", guests: "٢" });
    expect(result).toMatchObject({ ok: true, check_in: "2026-11-12", check_out: "2026-11-14", guests: 2 });
  });

  it("works out how many rooms a larger party needs", async () => {
    const result = await call("check_availability", { ...QUIET_DATES, guests: 5 });

    const byRoom = Object.fromEntries(
      result.options.map((option: { room_type: string; rooms_needed: number; total_sar: number }) => [
        option.room_type,
        [option.rooms_needed, option.total_sar],
      ]),
    );
    expect(byRoom).toEqual({
      "family-room": [1, 1840], // 920 x 2 nights
      "standard-city": [3, 2760], // 460 x 2 nights x 3 rooms
      "deluxe-sea": [2, 2760], // 690 x 2 nights x 2 rooms
      "executive-suite": [2, 5520], // 1380 x 2 nights x 2 rooms
    });
    expect(result.options[0].room_type).toBe("family-room");
  });

  it("sends a party that needs more than 3 rooms to staff", async () => {
    const result = await call("check_availability", { ...QUIET_DATES, guests: 16 });

    expect(result).toMatchObject({ ok: false, error: "group_booking" });
    expect(result.message).toContain("handoff_to_staff");
  });

  it("looks at one room type when asked, and suggests widening the search if it is full", async () => {
    const result = await call("check_availability", { ...WEEKEND, guests: 4, room_type: "family-room" });

    expect(result.ok).toBe(true);
    expect(result.options).toEqual([]);
    expect(result.not_available[0]).toMatchObject({ room_type: "family-room", reason: "sold_out" });
    expect(result.note).toContain("without room_type");
  });

  it("rejects a room type that does not exist and lists the real ones", async () => {
    const result = await call("check_availability", { ...WEEKEND, guests: 2, room_type: "penthouse" });

    expect(result).toMatchObject({ ok: false, error: "unknown_room_type" });
    expect(result.valid_room_types).toContain("executive-suite");
  });

  it("rejects a check-in in the past and tells the model today's date", async () => {
    const result = await call("check_availability", { check_in: "2026-11-10", check_out: "2026-11-12", guests: 2 });

    expect(result).toMatchObject({ ok: false, error: "check_in_in_past", today: TODAY });
    expect(result.message).toContain(TODAY);
  });

  it("rejects a check-out that is not after the check-in", async () => {
    const result = await call("check_availability", { check_in: "2026-11-14", check_out: "2026-11-12", guests: 2 });
    expect(result).toMatchObject({ ok: false, error: "check_out_not_after_check_in" });
  });

  it("reports every bad argument at once", async () => {
    const result = await call("check_availability", { check_in: "2026-02-30", check_out: "next week", guests: 0 });

    expect(result).toMatchObject({ ok: false, error: "invalid_arguments" });
    expect(result.problems).toHaveLength(3);
  });
});

describe("create_booking_hold", () => {
  const validHold = {
    name: "Sara Ahmed",
    phone: "055 123 4567",
    room_type: "deluxe-sea",
    ...WEEKEND,
    guests: 2,
    guest_confirmed: true,
  };

  it("holds the room and returns a reference code and the price", async () => {
    const result = await call("create_booking_hold", validHold);

    expect(result.ok).toBe(true);
    expect(result.booking).toMatchObject({
      status: "hold",
      room_type: "deluxe-sea",
      rooms: 1,
      nights: 2,
      total_sar: 1380,
      vat_included_sar: 180,
      guest_name: "Sara Ahmed",
      phone: "+966551234567",
    });
    expect(result.booking.reference_code).toMatch(/^SDH-[A-Z2-9]{4}$/);
  });

  it("saves the booking with the session and the guest's language", async () => {
    const result = await call("create_booking_hold", { ...validHold, notes: "Airport pickup, flight SV123" }, { ...ctx, language: "mixed" });

    const [stored] = await repo.listBookings();
    expect(stored).toMatchObject({
      referenceCode: result.booking.reference_code,
      sessionId: "session-1",
      language: "mixed",
      notes: "Airport pickup, flight SV123",
      totalHalalas: 138_000,
      createdAt: NOW.toISOString(),
    });
  });

  it("refuses to book until the guest has confirmed", async () => {
    const bookingsBefore = (await repo.listBookings()).length;

    const result = await call("create_booking_hold", { ...validHold, guest_confirmed: false });

    expect(result).toMatchObject({ ok: false, error: "not_confirmed" });
    expect(await repo.listBookings()).toHaveLength(bookingsBefore);
  });

  it("rejects a phone number that cannot be real", async () => {
    const result = await call("create_booking_hold", { ...validHold, phone: "12345" });
    expect(result).toMatchObject({ ok: false, error: "invalid_phone" });
  });

  it("accepts a phone number written in Arabic digits", async () => {
    const result = await call("create_booking_hold", { ...validHold, phone: "٠٥٥١٢٣٤٥٦٧" });
    expect(result.booking.phone).toBe("+966551234567");
  });

  it("says sold out when the room type is full", async () => {
    const result = await call("create_booking_hold", { ...validHold, room_type: "family-room", guests: 4 });
    expect(result).toMatchObject({ ok: false, error: "sold_out" });
  });

  it("gives the last suite to the first guest only", async () => {
    const suite = { ...validHold, room_type: "executive-suite" };

    const first = await call("create_booking_hold", suite);
    const second = await call("create_booking_hold", { ...suite, name: "Omar Khalid" });

    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: false, error: "sold_out" });
  });

  it("books as many rooms as the party needs", async () => {
    const result = await call("create_booking_hold", { ...validHold, ...QUIET_DATES, guests: 4 });

    // A Deluxe room takes 3 guests, so 4 guests need 2 rooms: 690 x 2 nights x 2 rooms.
    expect(result.booking).toMatchObject({ rooms: 2, total_sar: 2760 });
  });

  it("rejects fewer rooms than the party needs", async () => {
    const result = await call("create_booking_hold", { ...validHold, ...QUIET_DATES, guests: 4, rooms: 1 });
    expect(result).toMatchObject({ ok: false, error: "too_many_guests" });
  });

  it("sends a party that needs more than 3 rooms to staff", async () => {
    const result = await call("create_booking_hold", { ...validHold, ...QUIET_DATES, guests: 16 });
    expect(result).toMatchObject({ ok: false, error: "group_booking" });
  });

  it("checks the dates again, even if availability was never checked", async () => {
    const result = await call("create_booking_hold", { ...validHold, check_in: "2026-11-01", check_out: "2026-11-03" });
    expect(result).toMatchObject({ ok: false, error: "check_in_in_past" });
  });

  it("lists every missing detail", async () => {
    const result = await call("create_booking_hold", { room_type: "deluxe-sea" });

    expect(result).toMatchObject({ ok: false, error: "invalid_arguments" });
    expect(result.problems.join(" ")).toContain("name");
    expect(result.problems.join(" ")).toContain("phone");
    expect(result.problems.join(" ")).toContain("guest_confirmed");
  });

  it("tries a new reference code when the first one is already taken", async () => {
    const codes = ["SDH-K7M2", "SDH-ZZZ9"]; // the first belongs to a booking in the demo data
    const result = await call("create_booking_hold", validHold, { ...ctx, newReferenceCode: () => codes.shift()! });

    expect(result.booking.reference_code).toBe("SDH-ZZZ9");
  });
});

describe("handoff_to_staff", () => {
  const validHandoff = {
    reason: "complaint",
    urgency: "high",
    summary_en: "Guest is upset about noise from the room next door and wants to move.",
    summary_ar: "الضيف منزعج من الإزعاج في الغرفة المجاورة ويريد تغيير غرفته.",
    guest_details: { name: "Sara Ahmed", phone: "0551234567", booking_reference: "SDH-M8YC" },
  };

  it("opens a ticket with the summary in both languages", async () => {
    const result = await call("handoff_to_staff", validHandoff, { ...ctx, language: "ar" });

    expect(result).toMatchObject({ ok: true, ticket: { reason: "complaint", urgency: "high", status: "open" } });
    const [stored] = await repo.listTickets();
    expect(stored).toMatchObject({
      id: result.ticket.id,
      summaryEn: validHandoff.summary_en,
      summaryAr: validHandoff.summary_ar,
      guestName: "Sara Ahmed",
      phone: "+966551234567",
      bookingReference: "SDH-M8YC",
      language: "ar",
      sessionId: "session-1",
      status: "open",
    });
  });

  it("works without any guest details", async () => {
    const result = await call("handoff_to_staff", { ...validHandoff, guest_details: undefined });

    expect(result.ok).toBe(true);
    const [stored] = await repo.listTickets();
    expect(stored).toMatchObject({ guestName: null, phone: null, bookingReference: null });
  });

  it("falls back to safe defaults instead of refusing an unusual reason or urgency", async () => {
    const result = await call("handoff_to_staff", { ...validHandoff, reason: "guest is furious", urgency: "URGENT!!" });
    expect(result.ticket).toMatchObject({ reason: "other", urgency: "normal" });
  });

  it("uses the one summary it was given for both languages", async () => {
    await call("handoff_to_staff", { reason: "human_request", urgency: "normal", summary_en: "Guest asks for a manager." });

    const [stored] = await repo.listTickets();
    expect(stored?.summaryEn).toBe("Guest asks for a manager.");
    expect(stored?.summaryAr).toBe("Guest asks for a manager.");
  });

  it("keeps a phone number it cannot validate, so staff still see it", async () => {
    await call("handoff_to_staff", { ...validHandoff, guest_details: { phone: "ext. 204" } });

    const [stored] = await repo.listTickets();
    expect(stored?.phone).toBe("ext. 204");
  });

  it("only refuses when there is no summary at all", async () => {
    const result = await call("handoff_to_staff", { reason: "complaint", urgency: "high" });
    expect(result).toMatchObject({ ok: false, error: "missing_summary" });
  });
});

describe("runTool", () => {
  it("answers an unknown tool name with a readable failure", async () => {
    const result = await call("delete_all_bookings", {});
    expect(result).toMatchObject({ ok: false, error: "unknown_tool" });
  });

  it("turns a crash inside a tool into a failure the model can react to", async () => {
    const brokenRepo = new MemoryRepository();
    brokenRepo.listRooms = async () => {
      throw new Error("database is down");
    };

    const result = await call("get_hotel_info", { topic: "rooms" }, { ...ctx, repo: brokenRepo });

    expect(result).toMatchObject({ ok: false, error: "internal_error" });
    expect(result.message).not.toContain("database is down");
  });
});
