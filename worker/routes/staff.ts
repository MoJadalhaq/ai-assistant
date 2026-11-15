// /api/staff: what the staff dashboard reads and the two things it can change.
//
// Demo mode: there is no sign-in, so anyone can open the dashboard. That is acceptable because all
// data is fictional and reset every night, and it is made safe by two rules:
//   - phone numbers leave the Worker partly hidden (maskPhone), never in full;
//   - the two actions that change data are rate-limited per visitor.

import { Hono } from "hono";
import type {
  ResetDemoSuccess,
  ResolveTicketSuccess,
  StaffBooking,
  StaffFailure,
  StaffOverview,
  StaffTicket,
  TicketConversationSuccess,
} from "../../shared/api-types.ts";
import type { Booking, Ticket } from "../../shared/types.ts";
import { readTicketConversation } from "../data/conversations.ts";
import { D1Repository } from "../data/d1-repository.ts";
import { resetDemo } from "../data/reset-demo.ts";
import { addDays, riyadhToday } from "../domain/dates.ts";
import { maskPhone, maskPhonesInText } from "../domain/phone.ts";

const RETRY_SECONDS = 60;
/** How many nights the free-rooms grid shows. */
const GRID_NIGHTS = 14;

export const staff = new Hono<{ Bindings: Env }>();

// Read-only, polled every few seconds by the dashboard. Not rate-limited: polling would trip it.
staff.get("/overview", async (c) => {
  const repo = new D1Repository(c.env.DB);
  const today = riyadhToday(new Date());
  const grid = { checkIn: today, checkOut: addDays(today, GRID_NIGHTS) };
  const [nightly, bookings, tickets] = await Promise.all([
    repo.listNightlyAvailability(grid),
    repo.listBookings(),
    repo.listTickets(),
  ]);

  const body: StaffOverview = {
    ok: true,
    today,
    nights: Array.from({ length: GRID_NIGHTS }, (_, index) => addDays(today, index)),
    rooms: nightly.map(({ room, freeByNight }) => ({
      code: room.code,
      nameEn: room.nameEn,
      nameAr: room.nameAr,
      totalUnits: room.totalUnits,
      freeByNight,
    })),
    bookings: bookings.map(toStaffBooking),
    tickets: tickets.map(toStaffTicket),
  };
  // Always fresh: a cached answer would hide a ticket that just arrived.
  c.header("cache-control", "no-store");
  return c.json(body);
});

staff.post("/tickets/:id/resolve", async (c) => {
  if (!(await withinLimit(c.env, c.req.header("cf-connecting-ip")))) {
    return c.json(failure("rate_limited", RETRY_SECONDS), 429);
  }

  const id = c.req.param("id");
  if (!/^\d{1,9}$/.test(id)) return c.json(failure("invalid_request"), 400);

  const ticket = await new D1Repository(c.env.DB).resolveTicket(Number(id), new Date().toISOString());
  if (!ticket) return c.json(failure("not_found"), 404);

  const body: ResolveTicketSuccess = { ok: true, ticket: toStaffTicket(ticket) };
  return c.json(body);
});

// The chat that led to a ticket. Read-only, fetched when staff open it, so not rate-limited.
staff.get("/tickets/:id/conversation", async (c) => {
  const id = c.req.param("id");
  if (!/^\d{1,9}$/.test(id)) return c.json(failure("invalid_request"), 400);

  const messages = await readTicketConversation(c.env.DB, Number(id));
  if (messages === null) return c.json(failure("not_found"), 404);

  const body: TicketConversationSuccess = { ok: true, messages };
  return c.json(body);
});

staff.post("/reset", async (c) => {
  if (!(await withinLimit(c.env, c.req.header("cf-connecting-ip")))) {
    return c.json(failure("rate_limited", RETRY_SECONDS), 429);
  }

  const { today } = await resetDemo(c.env.DB, new Date());
  const body: ResetDemoSuccess = { ok: true, today };
  return c.json(body);
});

/**
 * Reuses the chat's burst limiter with its own key per visitor ("staff:<ip>"), so clicking
 * Reset doesn't use up chat messages, and the other way round.
 */
async function withinLimit(env: Env, ip: string | undefined): Promise<boolean> {
  const { success } = await env.CHAT_RATE_LIMITER.limit({ key: `staff:${ip ?? "local"}` });
  return success;
}

function failure(error: StaffFailure["error"], retryAfterSeconds?: number): StaffFailure {
  return retryAfterSeconds ? { ok: false, error, retryAfterSeconds } : { ok: false, error };
}

export function toStaffBooking({ sessionId, phone, ...booking }: Booking): StaffBooking {
  return { ...booking, phone: maskPhone(phone), fromChat: sessionId !== null };
}

export function toStaffTicket({ sessionId, phone, ...ticket }: Ticket): StaffTicket {
  return {
    ...ticket,
    summaryEn: maskPhonesInText(ticket.summaryEn),
    summaryAr: maskPhonesInText(ticket.summaryAr),
    phone: phone === null ? null : maskPhone(phone),
    fromChat: sessionId !== null,
  };
}
