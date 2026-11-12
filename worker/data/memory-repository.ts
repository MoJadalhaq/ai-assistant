import type { Booking, Room, Ticket } from "../../shared/types.ts";
import { unitsLeftForStay } from "../domain/availability.ts";
import type { BookedStay, Stay } from "../domain/availability.ts";
import type {
  CreateHoldResult,
  HotelRepository,
  NewBookingHold,
  NewTicket,
  RoomAvailability,
  SeedData,
} from "./repository.ts";
import { LIST_LIMIT } from "./repository.ts";

/**
 * The hotel's data in plain arrays. Nothing is saved anywhere.
 *
 * Used where a real database would get in the way: each eval case starts from a fresh,
 * known state, and the terminal chat runs without a server.
 */
export class MemoryRepository implements HotelRepository {
  private rooms: Room[] = [];
  private bookings: Booking[] = [];
  private tickets: Ticket[] = [];
  private nextBookingId = 1;
  private nextTicketId = 1;

  async listRooms(): Promise<Room[]> {
    return [...this.rooms].sort(cheapestFirst);
  }

  async listAvailability(stay: Stay): Promise<RoomAvailability[]> {
    const rooms = await this.listRooms();
    return rooms.map((room) => ({
      room,
      unitsLeft: unitsLeftForStay(room.totalUnits, this.activeBookingsOf(room.code), stay),
    }));
  }

  async createBookingHold(hold: NewBookingHold): Promise<CreateHoldResult> {
    if (this.bookings.some((booking) => booking.referenceCode === hold.referenceCode)) {
      return { status: "reference_taken" };
    }

    const room = this.rooms.find((candidate) => candidate.code === hold.roomCode);
    if (!room) return { status: "sold_out" };

    // No `await` between this check and the push below, so nothing else can run in between.
    const unitsLeft = unitsLeftForStay(room.totalUnits, this.activeBookingsOf(room.code), hold);
    if (unitsLeft < hold.rooms) return { status: "sold_out" };

    const booking: Booking = { ...hold, id: this.nextBookingId++, status: "hold" };
    this.bookings.push(booking);
    return { status: "created", booking };
  }

  async createTicket(ticket: NewTicket): Promise<Ticket> {
    const created: Ticket = { ...ticket, id: this.nextTicketId++, status: "open", resolvedAt: null };
    this.tickets.push(created);
    return created;
  }

  async listBookings(): Promise<Booking[]> {
    return [...this.bookings].sort(newestFirst).slice(0, LIST_LIMIT);
  }

  async listTickets(): Promise<Ticket[]> {
    return [...this.tickets].sort(newestFirst).slice(0, LIST_LIMIT);
  }

  async resolveTicket(id: number, resolvedAt: string): Promise<Ticket | null> {
    const ticket = this.tickets.find((item) => item.id === id);
    if (!ticket) return null;
    ticket.status = "resolved";
    ticket.resolvedAt ??= resolvedAt;
    return { ...ticket };
  }

  async replaceAllData(seed: SeedData): Promise<void> {
    this.rooms = seed.rooms.map((room) => ({ ...room }));
    this.nextBookingId = 1;
    this.nextTicketId = 1;
    this.bookings = seed.bookings.map((booking) => ({ ...booking, id: this.nextBookingId++ }));
    this.tickets = seed.tickets.map((ticket) => ({ ...ticket, id: this.nextTicketId++ }));
  }

  /** Cancelled bookings no longer take up a room. */
  private activeBookingsOf(roomCode: string): BookedStay[] {
    return this.bookings.filter((booking) => booking.roomCode === roomCode && booking.status !== "cancelled");
  }
}

function cheapestFirst(a: Room, b: Room): number {
  return a.nightlyRateHalalas - b.nightlyRateHalalas;
}

function newestFirst(a: { id: number }, b: { id: number }): number {
  return b.id - a.id;
}
