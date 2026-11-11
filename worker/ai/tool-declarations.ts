// What the model is told about each tool: name, purpose and arguments (as JSON Schema).
// The descriptions matter as much as the system prompt: the model reads them to decide
// when to call a tool and how to fill it in.

import type { FunctionDeclaration } from "@google/genai";
import { HANDOFF_REASONS, URGENCIES } from "../../shared/types.ts";
import { ROOM_TYPES, TOPIC_IDS } from "../data/hotel-kb.ts";

const ROOM_TYPE_CODES = ROOM_TYPES.map((room) => room.code);

const isoDate = (description: string) => ({ type: "string", format: "date", description });

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_hotel_info",
    description:
      "Look up facts about the hotel. Call it before answering any question about rooms, prices, times, policies, services or location. It is the only source of hotel facts.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        topic: { type: "string", enum: TOPIC_IDS, description: "The topic to look up." },
      },
      required: ["topic"],
    },
  },
  {
    name: "check_availability",
    description:
      "Find which room types are free for a stay and what the stay costs in total. Call it before offering any room or price for specific dates.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        check_in: isoDate("Arrival date, YYYY-MM-DD."),
        check_out: isoDate("Departure date, YYYY-MM-DD. A one-night stay checks out the next day."),
        guests: { type: "integer", minimum: 1, description: "Total number of guests, children included." },
        room_type: {
          type: "string",
          enum: ROOM_TYPE_CODES,
          description: "Only if the guest asked for a specific room type. Leave it out to see every option.",
        },
      },
      required: ["check_in", "check_out", "guests"],
    },
  },
  {
    name: "create_booking_hold",
    description:
      "Hold a room for the guest and get a booking reference. No payment is involved. Only call it after reading every detail back to the guest and getting a clear yes.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Guest's full name as they gave it." },
        phone: { type: "string", description: "Guest's mobile number as they gave it." },
        room_type: { type: "string", enum: ROOM_TYPE_CODES },
        check_in: isoDate("Arrival date, YYYY-MM-DD."),
        check_out: isoDate("Departure date, YYYY-MM-DD."),
        guests: { type: "integer", minimum: 1 },
        rooms: {
          type: "integer",
          minimum: 1,
          maximum: 3,
          description: "Number of rooms. Leave it out to use rooms_needed from check_availability.",
        },
        guest_confirmed: {
          type: "boolean",
          description: "true only if the guest clearly said yes to the details you read back.",
        },
        notes: {
          type: "string",
          description: "Special requests, e.g. airport pickup with flight number, baby cot, late arrival.",
        },
      },
      required: ["name", "phone", "room_type", "check_in", "check_out", "guests", "guest_confirmed"],
    },
  },
  {
    name: "handoff_to_staff",
    description:
      "Pass the conversation to the hotel team. Use it when the guest asks for a person, is upset or complaining, needs something the hotel information does not cover, needs more than 3 rooms or special pricing, or has medical or accessibility needs.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        reason: { type: "string", enum: [...HANDOFF_REASONS] },
        urgency: {
          type: "string",
          enum: [...URGENCIES],
          description: "high: guest is staying now and has a problem, or is very upset. low: general question. Otherwise normal.",
        },
        summary_en: {
          type: "string",
          description: "1 or 2 sentences in English: who the guest is, what they need, dates or booking reference if known.",
        },
        summary_ar: { type: "string", description: "The same summary in Arabic." },
        guest_details: {
          type: "object",
          description: "Whatever the guest has shared. Leave out what you don't know.",
          properties: {
            name: { type: "string" },
            phone: { type: "string" },
            booking_reference: { type: "string" },
          },
        },
      },
      required: ["reason", "urgency", "summary_en", "summary_ar"],
    },
  },
];
