import { riyadhToday } from "../domain/dates.ts";
import { D1Repository } from "./d1-repository.ts";
import { buildSeedData } from "./seed.ts";

/**
 * Puts the demo hotel back to its starting state, dated from today.
 *
 * Runs every night from the Cron Trigger (wrangler.jsonc) and when someone presses "Reset demo"
 * on the staff dashboard. The seed is built relative to today, so "the coming weekend is nearly
 * full" stays true whatever day a visitor arrives.
 */
export async function resetDemo(db: D1Database, now: Date): Promise<{ today: string }> {
  const today = riyadhToday(now);
  await new D1Repository(db).replaceAllData(buildSeedData(today, now.toISOString()));

  // Old message counters are no longer needed. Today's are kept on purpose: otherwise pressing
  // "Reset demo" would hand every visitor a fresh daily message budget.
  await db.prepare("DELETE FROM usage_counters WHERE day < ?").bind(today).run();
  return { today };
}
