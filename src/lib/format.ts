import type { UiLanguage } from "../i18n/strings.ts";

// Arabic dates in the Gregorian calendar with Western digits, matching what the assistant writes.
// (Plain "ar-SA" would default to the Hijri calendar and Arabic-Indic digits.)
const LOCALES: Record<UiLanguage, string> = { ar: "ar-SA-u-ca-gregory-nu-latn", en: "en-GB" };

/** '2026-11-12' becomes "Thu 12 Nov" or "الخميس 12 نوفمبر". */
export function formatDate(date: string, language: UiLanguage): string {
  const format = new Intl.DateTimeFormat(LOCALES[language], {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return format.format(new Date(`${date}T00:00:00Z`));
}

/** A UTC timestamp shown in hotel time: "12 Nov, 14:05" or "12 نوفمبر، 14:05". */
export function formatDateTime(iso: string, language: UiLanguage): string {
  const format = new Intl.DateTimeFormat(LOCALES[language], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Riyadh",
  });
  return format.format(new Date(iso));
}

/** The Riyadh calendar date of a UTC timestamp. Riyadh is UTC+3 all year (no daylight saving). */
export function riyadhDate(iso: string): string {
  return new Date(Date.parse(iso) + 3 * 3600_000).toISOString().slice(0, 10);
}

/** Column header for the free-rooms grid: "Thu" over "12", or "الخميس" over "12". */
export function formatNightHeader(date: string, language: UiLanguage): { weekday: string; day: string } {
  const at = new Date(`${date}T00:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat(LOCALES[language], { weekday: "short", timeZone: "UTC" }).format(at),
    day: new Intl.DateTimeFormat(LOCALES[language], { day: "numeric", timeZone: "UTC" }).format(at),
  };
}

export function formatAmount(amount: number, language: UiLanguage): string {
  return new Intl.NumberFormat(LOCALES[language], { maximumFractionDigits: 2 }).format(amount);
}
