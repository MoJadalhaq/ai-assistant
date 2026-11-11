// The one doorway between the hotel logic and wherever the data lives.
//
// Tools only ever talk to this interface. There are two implementations:
//   - D1Repository      the real database, used by the Worker
//   - MemoryRepository  plain arrays, used by the evals and the terminal chat
// The same test suite (repository.contract.ts) runs against both, so they can't drift apart.

import type { Booking, Room, Ticket } from "../../shared/types.ts";
import type { Stay } from "../domain/availability.ts";

export interface RoomAvailability {
  room: Room;
  /** Rooms of this type free on every night of the stay. */
  unitsLeft: number;
}

/** Everything about a hold except what the database decides (id) or is always the same (status). */
export type NewBookingHold = Omit<Booking, "id" | "status">;

export type CreateHoldResult =
  | { status: "created"; booking: Booking }
  /** Another guest took the last room between the availability check and this call. */
  | { status: "sold_out" }
  /** The random reference code already exists. The caller retries with a new one. */
  | { status: "reference_taken" };

export type NewTicket = Omit<Ticket, "id" | "status" | "resolvedAt">;

export interface SeedData {
  rooms: Room[];
  bookings: Omit<Booking, "id">[];
  tickets: Omit<Ticket, "id">[];
}

export interface HotelRepository {
  listRooms(): Promise<Room[]>;

  /** Every room type with the number of rooms free for the whole stay, cheapest first. */
  listAvailability(stay: Stay): Promise<RoomAvailability[]>;

  /**
   * Creates the hold only if enough rooms are still free.
   * The check and the insert must happen as one step, so two guests can't both get the last room.
   */
  createBookingHold(hold: NewBookingHold): Promise<CreateHoldResult>;

  createTicket(ticket: NewTicket): Promise<Ticket>;

  /** Newest first. */
  listBookings(): Promise<Booking[]>;
  listTickets(): Promise<Ticket[]>;

  /** Wipes everything and loads the given data. Used by the seed script and the daily reset. */
  replaceAllData(seed: SeedData): Promise<void>;
}
