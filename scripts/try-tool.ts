// Calls one of the assistant's tools by hand, against the local database, and prints the result.
// This is exactly what the AI will receive when it calls the tool.
//
//   npm run tool -- get_hotel_info topic=breakfast
//   npm run tool -- check_availability check_in=+1 check_out=+3 guests=2
//   npm run tool -- create_booking_hold name="Sara Ahmed" phone=0551234567 room_type=deluxe-sea check_in=+1 check_out=+3 guests=2 guest_confirmed=true
//   npm run tool -- handoff_to_staff reason=complaint urgency=high summary_en="AC not working" summary_ar="التكييف لا يعمل" guest_details.name="Sara Ahmed"
//
// Arguments are key=value pairs. For check_in and check_out, +N means N days from today in Riyadh,
// so the examples above keep working whatever the date is.

import { detectLanguage } from "../shared/text.ts";
import { addDays, riyadhToday } from "../worker/domain/dates.ts";
import { runTool, TOOLS } from "../worker/tools/index.ts";
import { withLocalRepository } from "./local-db.ts";

const [toolName, ...pairs] = process.argv.slice(2);

if (!toolName) {
  console.error(`Usage: npm run tool -- <tool> key=value ...\nTools: ${Object.keys(TOOLS).join(", ")}`);
  process.exit(1);
}

const now = new Date();
const toolArgs = parsePairs(pairs, riyadhToday(now));

await withLocalRepository(async (repo) => {
  const result = await runTool(toolName, toolArgs, {
    repo,
    now,
    sessionId: null,
    language: detectLanguage(pairs.join(" ")),
  });
  console.log(JSON.stringify(result, null, 2));
});

/** Turns ["guests=2", "guest_details.name=Sara"] into { guests: "2", guest_details: { name: "Sara" } }. */
function parsePairs(pairs: string[], today: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};

  for (const pair of pairs) {
    const separator = pair.indexOf("=");
    if (separator === -1) {
      console.error(`Ignoring "${pair}": arguments must look like key=value.`);
      continue;
    }
    const key = pair.slice(0, separator);
    const value = expandRelativeDate(key, pair.slice(separator + 1), today);

    const [parent, child] = key.split(".");
    if (parent && child) {
      const nested = (args[parent] ??= {}) as Record<string, unknown>;
      nested[child] = value;
    } else {
      args[key] = value;
    }
  }

  return args;
}

function expandRelativeDate(key: string, value: string, today: string): string {
  const isDateArgument = key === "check_in" || key === "check_out";
  const daysFromToday = /^\+(\d+)$/.exec(value);
  return isDateArgument && daysFromToday ? addDays(today, Number(daysFromToday[1])) : value;
}
