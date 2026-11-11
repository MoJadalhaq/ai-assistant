import { isRecord, normalizeDigitsDeep } from "../../shared/text.ts";
import { HANDOFF_REASONS, URGENCIES } from "../../shared/types.ts";
import { normalizePhone } from "../domain/phone.ts";
import { fail } from "./tool-types.ts";
import type { ToolContext, ToolResult } from "./tool-types.ts";

const MAX_SUMMARY_LENGTH = 600;
const MAX_DETAIL_LENGTH = 120;

/**
 * handoff_to_staff(reason, urgency, summary_en, summary_ar, guest_details?)
 *
 * Opens a ticket for the hotel team.
 *
 * Unlike the booking tools, this one forgives almost any mistake in its arguments.
 * A handoff is the safety net: it is called when a guest is upset or the assistant is out of
 * its depth, and the worst outcome is for that request to bounce over a formatting detail.
 * So unknown values fall back to safe defaults, long text is cut, and only a ticket with
 * no summary at all is refused.
 */
export async function handoffToStaff(rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
  const normalized = normalizeDigitsDeep(rawArgs);
  const args = isRecord(normalized) ? normalized : {};
  const guestDetails = isRecord(args.guest_details) ? args.guest_details : {};

  // If the model wrote the summary in one language only, staff still get that text in both fields.
  const summaryEn = cleanText(args.summary_en, MAX_SUMMARY_LENGTH) ?? cleanText(args.summary_ar, MAX_SUMMARY_LENGTH);
  const summaryAr = cleanText(args.summary_ar, MAX_SUMMARY_LENGTH) ?? cleanText(args.summary_en, MAX_SUMMARY_LENGTH);
  if (!summaryEn || !summaryAr) {
    return fail(
      "missing_summary",
      "Write one or two sentences saying what the guest needs, in summary_en (English) and summary_ar (Arabic), then call this tool again.",
    );
  }

  const phoneAsGiven = cleanText(guestDetails.phone, MAX_DETAIL_LENGTH);

  const ticket = await ctx.repo.createTicket({
    sessionId: ctx.sessionId,
    reason: pickFrom(HANDOFF_REASONS, args.reason) ?? "other",
    urgency: pickFrom(URGENCIES, args.urgency) ?? "normal",
    summaryEn,
    summaryAr,
    guestName: cleanText(guestDetails.name, MAX_DETAIL_LENGTH),
    // A number that doesn't pass validation is kept as the guest gave it: staff can still read it.
    phone: phoneAsGiven ? (normalizePhone(phoneAsGiven) ?? phoneAsGiven) : null,
    bookingReference: cleanText(guestDetails.booking_reference, MAX_DETAIL_LENGTH),
    language: ctx.language,
    createdAt: ctx.now.toISOString(),
  });

  return {
    ok: true,
    ticket: { id: ticket.id, reason: ticket.reason, urgency: ticket.urgency, status: ticket.status },
    note: "The hotel team has the request. Tell the guest a member of staff will follow up. Do not promise a specific time.",
  };
}

/** Trimmed text cut to a maximum length, or null when there is nothing usable. */
function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text === "" ? null : text.slice(0, maxLength);
}

function pickFrom<T extends string>(allowed: readonly T[], value: unknown): T | null {
  return allowed.find((item) => item === value) ?? null;
}
