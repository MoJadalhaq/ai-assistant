// Date helpers. Every date in the system is a plain 'YYYY-MM-DD' string in Riyadh time.
// Strings in that format sort in date order, so they can be compared with < and > directly,
// in TypeScript and in SQLite alike.

// Saudi Arabia is UTC+3 all year (no daylight saving), so Riyadh time is a fixed shift from UTC.
const RIYADH_UTC_OFFSET_HOURS = 3;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export const MAX_NIGHTS_PER_STAY = 14;
export const MAX_DAYS_AHEAD = 365;

/**
 * Today's date in Riyadh. `now` is passed in (never read from the clock here)
 * so tests and evals can freeze time.
 */
export function riyadhToday(now: Date): string {
  const shifted = new Date(now.getTime() + RIYADH_UTC_OFFSET_HOURS * MS_PER_HOUR);
  return shifted.toISOString().slice(0, 10);
}

/** Time of day in Riyadh, 'HH:MM'. */
export function riyadhClock(now: Date): string {
  const shifted = new Date(now.getTime() + RIYADH_UTC_OFFSET_HOURS * MS_PER_HOUR);
  return shifted.toISOString().slice(11, 16);
}

const ISO_DATE_SHAPE =/^\d{4}-\d{2}-\d{2}$/;

/** True only for a real calendar date written as 'YYYY-MM-DD'. */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_SHAPE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  // An impossible date such as 2026-02-30 either fails to parse or rolls over into March.
  // Either way it does not come back out as the same string.
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function toUtcMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcMs(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

export const SUNDAY = 0;
export const THURSDAY = 4;
export const FRIDAY = 5;
export const SATURDAY = 6;

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(date: string): number {
  return new Date(toUtcMs(date)).getUTCDay();
}

/** The first date on or after `from` that falls on `weekday`. */
export function nextWeekday(from: string, weekday: number): string {
  const daysAhead = (weekday - weekdayOf(from) + 7) % 7;
  return addDays(from, daysAhead);
}

export type StayProblem =
  | "check_in_in_past"
  | "check_out_not_after_check_in"
  | "stay_too_long"
  | "too_far_ahead";

/**
 * Checks the rules a stay must follow. Both dates must already be valid ISO dates.
 * Returns the first problem found, or null when the stay is fine.
 */
export function findStayProblem(checkIn: string, checkOut: string, today: string): StayProblem | null {
  if (checkIn < today) return "check_in_in_past";
  if (checkOut <= checkIn) return "check_out_not_after_check_in";
  if (daysBetween(checkIn, checkOut) > MAX_NIGHTS_PER_STAY) return "stay_too_long";
  if (daysBetween(today, checkIn) > MAX_DAYS_AHEAD) return "too_far_ahead";
  return null;
}
