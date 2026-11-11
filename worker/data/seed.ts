// Sample data for the demo. All guests, phone numbers and bookings here are invented.
//
// The bookings are dated relative to "today", so whenever the data is rebuilt (first setup,
// daily reset) the coming weekend looks like a real hotel's: some room types nearly full,
// one sold out. That gives the assistant something true to say about availability.

import type { Booking, BookingStatus, Language, Ticket } from "../../shared/types.ts";
import { MAX_ROOMS_PER_BOOKING } from "../domain/availability.ts";
import { addDays, daysBetween, nextWeekday, THURSDAY } from "../domain/dates.ts";
import { stayTotalHalalas } from "../domain/pricing.ts";
import { ROOM_TYPES } from "./hotel-kb.ts";
import type { SeedData } from "./repository.ts";

interface SampleBooking {
  referenceCode: string;
  guestName: string;
  phone: string;
  roomCode: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: BookingStatus;
  language: Language;
  notes?: string;
}

/**
 * Builds the demo data for a given day.
 * @param today      Riyadh date, 'YYYY-MM-DD'
 * @param createdAt  timestamp stamped on every row (UTC, ISO 8601)
 */
export function buildSeedData(today: string, createdAt: string): SeedData {
  // The Saudi weekend is Friday and Saturday, so a weekend stay checks in on Thursday.
  const thursday = nextWeekday(today, THURSDAY);
  const friday = addDays(thursday, 1);
  const saturday = addDays(thursday, 2);
  const sunday = addDays(thursday, 3);

  const samples: SampleBooking[] = [
    // Executive Suite (2 in the hotel): one taken for the weekend, so exactly one is left.
    { referenceCode: "SDH-K7M2", guestName: "Sara Ahmed", phone: "+966500000001", roomCode: "executive-suite", checkIn: thursday, checkOut: saturday, guests: 2, status: "confirmed", language: "en" },

    // Family Room (4 in the hotel): two taken on Thursday night, all four on Friday night.
    // A Thursday-to-Saturday stay is therefore sold out, although Thursday alone still has rooms.
    { referenceCode: "SDH-P4QX", guestName: "خالد العمري", phone: "+966500000002", roomCode: "family-room", checkIn: thursday, checkOut: saturday, guests: 5, status: "confirmed", language: "ar" },
    { referenceCode: "SDH-T9WB", guestName: "Omar Khalid", phone: "+966500000003", roomCode: "family-room", checkIn: thursday, checkOut: saturday, guests: 4, status: "confirmed", language: "mixed" },
    { referenceCode: "SDH-H3ZD", guestName: "نورة السالم", phone: "+966500000004", roomCode: "family-room", checkIn: friday, checkOut: sunday, guests: 4, status: "hold", language: "ar", notes: "سرير أطفال إضافي" },
    { referenceCode: "SDH-R6FV", guestName: "James Carter", phone: "+447000000005", roomCode: "family-room", checkIn: friday, checkOut: saturday, guests: 3, status: "confirmed", language: "en" },

    // Deluxe Sea View (6 in the hotel): lightly booked.
    { referenceCode: "SDH-M8YC", guestName: "Layla Hassan", phone: "+966500000006", roomCode: "deluxe-sea", checkIn: today, checkOut: addDays(today, 2), guests: 2, status: "confirmed", language: "en", notes: "Airport pickup requested" },
    { referenceCode: "SDH-E5JN", guestName: "فهد الدوسري", phone: "+966500000007", roomCode: "deluxe-sea", checkIn: thursday, checkOut: friday, guests: 3, status: "hold", language: "ar" },

    // Standard City View (8 in the hotel): plenty left.
    { referenceCode: "SDH-A2UG", guestName: "Yousef Nasser", phone: "+966500000008", roomCode: "standard-city", checkIn: today, checkOut: addDays(today, 1), guests: 1, status: "confirmed", language: "en" },
    { referenceCode: "SDH-W4SK", guestName: "ريم القحطاني", phone: "+966500000009", roomCode: "standard-city", checkIn: addDays(today, 1), checkOut: addDays(today, 4), guests: 2, status: "confirmed", language: "ar" },
    { referenceCode: "SDH-Q9TH", guestName: "Maria Lopez", phone: "+34600000010", roomCode: "standard-city", checkIn: thursday, checkOut: saturday, guests: 2, status: "hold", language: "en" },
  ];

  const tickets: Omit<Ticket, "id">[] = [
    {
      sessionId: null,
      reason: "complaint",
      urgency: "high",
      summaryEn: "Guest in a Deluxe room (booking SDH-M8YC) says the air conditioning has not cooled since last night. Wants a technician now or a room change.",
      summaryAr: "ضيفة في غرفة ديلوكس (حجز SDH-M8YC) تقول إن التكييف لا يبرّد منذ البارحة. تطلب فنياً حالاً أو تغيير الغرفة.",
      guestName: "Layla Hassan",
      phone: "+966500000006",
      bookingReference: "SDH-M8YC",
      language: "en",
      status: "open",
      createdAt,
      resolvedAt: null,
    },
    {
      sessionId: null,
      reason: "group_booking",
      urgency: "normal",
      summaryEn: "Guest asks for 6 rooms for a wedding party next weekend (Thursday to Saturday) and wants a group rate.",
      summaryAr: "ضيف يطلب 6 غرف لضيوف حفل زواج نهاية الأسبوع القادم (من الخميس إلى السبت) ويسأل عن سعر خاص للمجموعات.",
      guestName: "ماجد الحربي",
      phone: "+966500000011",
      bookingReference: null,
      language: "ar",
      status: "resolved",
      createdAt,
      resolvedAt: createdAt,
    },
  ];

  return {
    rooms: ROOM_TYPES,
    bookings: samples.map((sample) => toBooking(sample, createdAt)),
    tickets,
  };
}

/** Fills in the fields that follow from the others (nights, rooms, price). */
function toBooking(sample: SampleBooking, createdAt: string): Omit<Booking, "id"> {
  const room = ROOM_TYPES.find((candidate) => candidate.code === sample.roomCode);
  if (!room) throw new Error(`Seed booking ${sample.referenceCode} uses unknown room type ${sample.roomCode}`);

  const nights = daysBetween(sample.checkIn, sample.checkOut);
  const rooms = Math.min(Math.ceil(sample.guests / room.capacity), MAX_ROOMS_PER_BOOKING);

  return {
    referenceCode: sample.referenceCode,
    sessionId: null,
    guestName: sample.guestName,
    phone: sample.phone,
    roomCode: sample.roomCode,
    checkIn: sample.checkIn,
    checkOut: sample.checkOut,
    nights,
    guests: sample.guests,
    rooms,
    totalHalalas: stayTotalHalalas(room.nightlyRateHalalas, nights, rooms),
    notes: sample.notes ?? null,
    status: sample.status,
    language: sample.language,
    createdAt,
  };
}
