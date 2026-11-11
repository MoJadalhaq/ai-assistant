import type { Language } from "./types.ts";

const ARABIC_INDIC_ZERO = 0x0660; // ٠  (Arabic keyboards)
const EASTERN_ARABIC_INDIC_ZERO = 0x06f0; // ۰  (Persian and Urdu keyboards; they look almost the same)
const ANY_ARABIC_DIGIT = /[٠-٩۰-۹]/g;

/**
 * Turns Arabic-script digits into 0-9 and leaves everything else alone.
 * "٢٠٢٦-١١-١٣" becomes "2026-11-13".
 */
export function normalizeDigits(text: string): string {
  return text.replace(ANY_ARABIC_DIGIT, (digit) => {
    const code = digit.charCodeAt(0);
    const zero = code >= EASTERN_ARABIC_INDIC_ZERO ? EASTERN_ARABIC_INDIC_ZERO : ARABIC_INDIC_ZERO;
    return String(code - zero);
  });
}

/**
 * normalizeDigits for every string inside a JSON-like value.
 * Tool arguments arrive as nested objects, and a digit can hide in any field.
 */
export function normalizeDigitsDeep(value: unknown): unknown {
  if (typeof value === "string") return normalizeDigits(value);
  if (Array.isArray(value)) return value.map(normalizeDigitsDeep);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeDigitsDeep(item)]));
  }
  return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Letters only (hamza to yeh). Digits and punctuation are left out on purpose:
// "2 nights؟" should not count as Arabic just because of the question mark.
const ARABIC_LETTER = /[ء-ي]/;
const LATIN_LETTER = /[A-Za-z]/;

/**
 * Which language a piece of guest text is in.
 * Worked out in code, not asked from the model: it is cheap, repeatable and can't be talked out of the answer.
 */
export function detectLanguage(text: string): Language {
  const hasArabic = ARABIC_LETTER.test(text);
  const hasLatin = LATIN_LETTER.test(text);
  if (hasArabic && hasLatin) return "mixed";
  return hasArabic ? "ar" : "en";
}
