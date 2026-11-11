import { checkAvailability } from "./check-availability.ts";
import { createBookingHold } from "./create-booking-hold.ts";
import { getHotelInfo } from "./get-hotel-info.ts";
import { handoffToStaff } from "./handoff-to-staff.ts";
import { fail } from "./tool-types.ts";
import type { ToolContext, ToolHandler, ToolResult } from "./tool-types.ts";

export type { ToolContext, ToolResult } from "./tool-types.ts";

/** The tools the assistant can call, by the name the model uses. */
export const TOOLS = {
  get_hotel_info: getHotelInfo,
  check_availability: checkAvailability,
  create_booking_hold: createBookingHold,
  handoff_to_staff: handoffToStaff,
} satisfies Record<string, ToolHandler>;

export type ToolName = keyof typeof TOOLS;

export function isToolName(name: string): name is ToolName {
  return Object.hasOwn(TOOLS, name);
}

/**
 * Runs one tool call from the model and always returns a result the model can read.
 * A bug or a database error inside a tool becomes an "internal_error" result, so the assistant
 * can apologize and hand off instead of the whole chat request failing.
 */
export async function runTool(name: string, rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
  if (!isToolName(name)) {
    return fail("unknown_tool", `There is no tool "${name}". Available tools: ${Object.keys(TOOLS).join(", ")}.`);
  }

  try {
    return await TOOLS[name](rawArgs, ctx);
  } catch (error) {
    console.error(`Tool ${name} failed:`, error);
    return fail(
      "internal_error",
      "The tool failed because of a technical problem. Apologize briefly and offer to hand the guest to staff.",
    );
  }
}
