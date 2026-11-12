import { normalizeDigits } from "../../shared/text.ts";

const SEPARATORS = /[\s\-().]/g;

/**
 * Puts a phone number into international form, or returns null when it can't be a real number.
 *
 * Guests write Saudi mobiles many ways: 0551234567, 551234567, +966 55 123 4567,
 * 00966551234567, and with Arabic digits. Staff need one format they can dial.
 * Numbers from other countries are accepted as long as they are written with a country code.
 */
export function normalizePhone(raw: string): string | null {
  let number = normalizeDigits(raw).replace(SEPARATORS, "");
  if (number.startsWith("00")) number = `+${number.slice(2)}`;

  // Local Saudi mobile, with or without the leading zero.
  if (/^05\d{8}$/.test(number)) return `+966${number.slice(1)}`;
  if (/^5\d{8}$/.test(number)) return `+966${number}`;

  // Country code without the plus sign.
  if (/^9665\d{8}$/.test(number)) return `+${number}`;

  // Country code followed by the local leading zero: a very common slip.
  if (/^\+9660\d{9}$/.test(number)) number = `+966${number.slice(5)}`;

  // A Saudi number has exactly 9 digits after +966. Checked before the general rule below,
  // which would otherwise let a Saudi number with a missing digit through.
  if (number.startsWith("+966")) return /^\+966[1-9]\d{8}$/.test(number) ? number : null;

  // Any other country: the international standard (E.164) allows 8 to 15 digits.
  return /^\+[1-9]\d{7,14}$/.test(number) ? number : null;
}

const MASK = "•";

/**
 * Hides the middle of a phone number: +966512345678 becomes +9665•••••678.
 *
 * The staff dashboard is public in demo mode, so it never receives full numbers. The country code
 * and the last three digits are enough to tell two guests apart. Anything too short to be a phone
 * number is hidden completely.
 */
export function maskPhone(phone: string): string {
  const keepStart = phone.startsWith("+") ? 5 : 3;
  const keepEnd = 3;
  if (phone.length <= keepStart + keepEnd) return MASK.repeat(phone.length);
  return phone.slice(0, keepStart) + MASK.repeat(phone.length - keepStart - keepEnd) + phone.slice(-keepEnd);
}

// 9 to 15 digits, optionally with single spaces or dashes between them, in Western or Arabic digits.
const PHONE_IN_TEXT = /\+?[0-9٠-٩۰-۹](?:[ -]?[0-9٠-٩۰-۹]){8,14}/g;
const ISO_DATE = /\d{4}-\d{2}-\d{2}/;

/**
 * Masks phone numbers written inside free text, such as the AI's handoff summaries
 * ("Guest Omar (0551112233) wants the manager"). Masking only the phone field isn't enough:
 * the model often repeats the number in the summary.
 * Runs of digits that contain a date (2026-11-20 2026-11-22) are left alone.
 */
export function maskPhonesInText(text: string): string {
  return text.replace(PHONE_IN_TEXT, (match) => {
    const plain = normalizeDigits(match);
    return ISO_DATE.test(plain) ? match : maskPhone(plain.replace(/[ -]/g, ""));
  });
}
