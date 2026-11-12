import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { ResolveTicketSuccess, StaffOverview } from "../../shared/api-types.ts";
import { D1Repository } from "../data/d1-repository.ts";
import { ROOM_TYPES } from "../data/hotel-kb.ts";
import { app } from "../index.ts";

const repo = new D1Repository(env.DB);

beforeEach(async () => {
  await repo.replaceAllData({ rooms: ROOM_TYPES, bookings: [], tickets: [] });
});

async function chatBooking() {
  const result = await repo.createBookingHold({
    referenceCode: "SDH-TEST",
    sessionId: "session-1",
    guestName: "Test Guest",
    phone: "+966512345678",
    roomCode: "deluxe-sea",
    checkIn: "2026-11-20",
    checkOut: "2026-11-22",
    nights: 2,
    guests: 2,
    rooms: 1,
    totalHalalas: 138_000,
    notes: null,
    language: "en",
    createdAt: "2026-11-12T09:00:00.000Z",
  });
  if (result.status !== "created") throw new Error("setup failed");
  return result.booking;
}

function openTicket() {
  return repo.createTicket({
    sessionId: null,
    reason: "complaint",
    urgency: "high",
    summaryEn: "Noisy room. Call back on 0551112233.",
    summaryAr: "الغرفة مزعجة.",
    guestName: "Test Guest",
    phone: "+966512345678",
    bookingReference: null,
    language: "en",
    createdAt: "2026-11-12T09:00:00.000Z",
  });
}

describe("GET /api/staff/overview", () => {
  it("lists bookings and tickets with phone numbers partly hidden", async () => {
    await chatBooking();
    await openTicket();

    const response = await app.request("/api/staff/overview", {}, env);
    const body = (await response.json()) as StaffOverview;

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.rooms).toHaveLength(ROOM_TYPES.length);
    expect(body.bookings[0]).toMatchObject({ referenceCode: "SDH-TEST", phone: "+9665•••••678", fromChat: true });
    expect(body.tickets[0]).toMatchObject({ reason: "complaint", phone: "+9665•••••678", fromChat: false });
  });

  it("never sends a full phone number or a chat session id", async () => {
    await chatBooking();
    await openTicket();

    const text = await (await app.request("/api/staff/overview", {}, env)).text();

    expect(text).not.toContain("512345678");
    expect(text).not.toContain("1112233");
    expect(text).not.toContain("session-1");
  });
});

describe("POST /api/staff/tickets/:id/resolve", () => {
  it("marks the ticket resolved", async () => {
    const ticket = await openTicket();

    const response = await app.request(`/api/staff/tickets/${ticket.id}/resolve`, { method: "POST" }, env);
    const body = (await response.json()) as ResolveTicketSuccess;

    expect(response.status).toBe(200);
    expect(body.ticket).toMatchObject({ id: ticket.id, status: "resolved" });
    expect(body.ticket.resolvedAt).not.toBeNull();
  });

  it("answers 404 for an unknown ticket and 400 for a malformed id", async () => {
    const missing = await app.request("/api/staff/tickets/999/resolve", { method: "POST" }, env);
    const malformed = await app.request("/api/staff/tickets/abc/resolve", { method: "POST" }, env);

    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ ok: false, error: "not_found" });
    expect(malformed.status).toBe(400);
  });
});

describe("POST /api/staff/reset", () => {
  it("restores the demo data and keeps today's message counters", async () => {
    await chatBooking();
    await env.DB.prepare("INSERT INTO usage_counters (day, key, count) VALUES ('2000-01-01', 'global', 5), (?, 'global', 7)")
      .bind(new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10))
      .run();

    const response = await app.request("/api/staff/reset", { method: "POST" }, env);

    expect(response.status).toBe(200);
    const bookings = await repo.listBookings();
    expect(bookings.some((booking) => booking.referenceCode === "SDH-TEST")).toBe(false);
    expect(bookings.length).toBeGreaterThan(0);
    const counters = await env.DB.prepare("SELECT day, count FROM usage_counters").all<{ day: string; count: number }>();
    expect(counters.results.map((row) => row.count)).toEqual([7]);
  });
});
