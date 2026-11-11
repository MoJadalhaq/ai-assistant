import type { Room } from "../../shared/types.ts";
import { findInfoTopic, ROOMS_TOPIC, TOPIC_IDS } from "../data/hotel-kb.ts";
import { halalasToSar } from "../domain/pricing.ts";
import { ArgReader, invalidArguments } from "./args.ts";
import { fail } from "./tool-types.ts";
import type { ToolContext, ToolResult } from "./tool-types.ts";

/**
 * get_hotel_info(topic): the only way the assistant learns hotel facts.
 *
 * The facts are not pasted into the assistant's instructions. It has to ask for a topic,
 * which leaves a record of where every answer came from, and an unknown topic gives it
 * a clear signal to hand off to staff.
 */
export async function getHotelInfo(rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
  const args = new ArgReader(rawArgs);
  const topic = args.string("topic", 40);
  if (args.problems.length > 0) return invalidArguments(args.problems);

  if (topic === ROOMS_TOPIC.id) {
    const rooms = await ctx.repo.listRooms();
    return { ok: true, topic, currency: "SAR", prices_include_vat: true, rooms: rooms.map(describeRoom) };
  }

  const info = findInfoTopic(topic);
  if (!info) {
    return fail(
      "unknown_topic",
      `There is no topic "${topic}". Pick one from "topics". If none covers the guest's question, the hotel information does not have the answer: call handoff_to_staff with reason "out_of_scope".`,
      { topics: TOPIC_IDS },
    );
  }

  return { ok: true, topic, info_en: info.en, info_ar: info.ar };
}

function describeRoom(room: Room) {
  return {
    room_type: room.code,
    name_en: room.nameEn,
    name_ar: room.nameAr,
    description_en: room.descriptionEn,
    description_ar: room.descriptionAr,
    max_guests_per_room: room.capacity,
    price_per_night_sar: halalasToSar(room.nightlyRateHalalas),
  };
}
