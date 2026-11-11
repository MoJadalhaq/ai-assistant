// Daily message budget for the public demo.
//
// The Workers rate-limit binding only counts per 10 or 60 seconds, so it can't stop the demo
// from using up the Gemini free tier's DAILY quota. These counters can: when today's budget is
// spent, guests get a clear "come back tomorrow" instead of failing halfway through a booking.

import { riyadhToday, secondsUntilRiyadhMidnight } from "../domain/dates.ts";

export interface DailyLimits {
  perVisitor: number;
  total: number;
}

export type QuotaDecision =
  | { allowed: true }
  | { allowed: false; scope: "visitor" | "total"; retryAfterSeconds: number };

// Adds 1 and returns the new count in a single statement. The upsert is atomic, so two requests
// arriving together can't both read the same count and both slip under the limit.
const INCREMENT_SQL = `
  INSERT INTO usage_counters (day, key, count) VALUES (?1, ?2, 1)
  ON CONFLICT (day, key) DO UPDATE SET count = count + 1
  RETURNING count`;

async function increment(db: D1Database, day: string, key: string): Promise<number> {
  const row = await db.prepare(INCREMENT_SQL).bind(day, key).first<{ count: number }>();
  return row?.count ?? Number.POSITIVE_INFINITY;
}

/** Counts one guest message against today's budget, and says whether it may go ahead. */
export async function takeDailyQuota(
  db: D1Database,
  visitor: string,
  limits: DailyLimits,
  now: Date,
): Promise<QuotaDecision> {
  const day = riyadhToday(now);
  const retryAfterSeconds = secondsUntilRiyadhMidnight(now);

  // The visitor's own counter first. A visitor who is already over their limit must not
  // keep eating into the shared budget, or one person could lock everyone else out.
  const visitorCount = await increment(db, day, `visitor:${visitor}`);
  if (visitorCount > limits.perVisitor) return { allowed: false, scope: "visitor", retryAfterSeconds };

  const totalCount = await increment(db, day, "global");
  if (totalCount > limits.total) return { allowed: false, scope: "total", retryAfterSeconds };

  return { allowed: true };
}
