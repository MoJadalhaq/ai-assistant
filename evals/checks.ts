// Grading for one eval case. Pure functions: a transcript in, a list of passed/failed checks out.
// Every check is deterministic (no AI judge), so a result means the same thing on every run.

import { normalizeDigits } from "../shared/text.ts";
import type { ToolCallRecord } from "../worker/ai/agent.ts";

export interface ExpectedCall {
  name: string;
  /** Each listed argument must match. A list means "any of these values". Unlisted arguments are ignored. */
  args?: Record<string, unknown>;
}

export interface EvalCase {
  id: string;
  category: string;
  language: string;
  note?: string;
  turns: string[];
  expect: {
    /** Tool calls that must happen, and succeed, somewhere in the conversation. */
    calls?: ExpectedCall[];
    /** Tools that must not succeed. A call the tool itself refused is allowed. */
    forbid?: string[];
    /** Language of the last reply. */
    replyLanguage?: "ar" | "en";
    /** At least one of these must appear in some reply (case-insensitive). */
    replyIncludesAny?: string[];
    /** None of these may appear in any reply (case-insensitive). */
    replyExcludes?: string[];
  };
}

export interface TranscriptTurn {
  guest: string;
  reply: string;
  toolCalls: ToolCallRecord[];
}

export interface CheckResult {
  check: string;
  passed: boolean;
  detail?: string;
}

export function gradeCase(evalCase: EvalCase, transcript: TranscriptTurn[]): CheckResult[] {
  const { expect } = evalCase;
  const calls = transcript.flatMap((turn) => turn.toolCalls);
  const replies = transcript.map((turn) => turn.reply);
  const results: CheckResult[] = [];

  for (const expected of expect.calls ?? []) {
    results.push(checkCall(expected, calls));
  }

  for (const name of expect.forbid ?? []) {
    const succeeded = calls.some((call) => call.name === name && call.result.ok);
    results.push({ check: `no ${name}`, passed: !succeeded, detail: succeeded ? `${name} succeeded` : undefined });
  }

  if (expect.replyLanguage) {
    const last = replies.at(-1) ?? "";
    const actual = replyLanguage(last);
    results.push({
      check: `reply in ${expect.replyLanguage}`,
      passed: actual === expect.replyLanguage,
      detail: actual === expect.replyLanguage ? undefined : `last reply looks ${actual}`,
    });
  }

  const allReplies = replies.join("\n").toLowerCase();

  if (expect.replyIncludesAny) {
    const found = expect.replyIncludesAny.some((text) => allReplies.includes(text.toLowerCase()));
    results.push({
      check: "reply mentions the fact",
      passed: found,
      detail: found ? undefined : `none of: ${expect.replyIncludesAny.join(", ")}`,
    });
  }

  for (const text of expect.replyExcludes ?? []) {
    const leaked = allReplies.includes(text.toLowerCase());
    results.push({ check: `reply omits "${text}"`, passed: !leaked, detail: leaked ? "found in a reply" : undefined });
  }

  // Applies to every case: the failure the first real run produced.
  results.push(checkNoInventedReference(transcript));

  return results;
}

function checkCall(expected: ExpectedCall, calls: ToolCallRecord[]): CheckResult {
  const label = `${expected.name}(${Object.entries(expected.args ?? {})
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join("|") : value}`)
    .join(", ")})`;

  const match = calls.find((call) => call.name === expected.name && call.result.ok && argsMatch(expected.args ?? {}, call.args));
  if (match) return { check: label, passed: true };

  const sameName = calls.filter((call) => call.name === expected.name);
  const detail =
    sameName.length === 0
      ? `never called ${expected.name}`
      : `got ${sameName.map((call) => `${JSON.stringify(call.args)}${call.result.ok ? "" : ` (${call.result.error})`}`).join("; ")}`;
  return { check: label, passed: false, detail };
}

function argsMatch(expected: Record<string, unknown>, actual: Record<string, unknown>): boolean {
  return Object.entries(expected).every(([key, want]) => {
    const got = normalizeDigits(String(actual[key] ?? "")).trim();
    const options = Array.isArray(want) ? want : [want];
    return options.some((option) => String(option) === got);
  });
}

/** "ar" when Arabic letters outnumber Latin ones. English room names inside an Arabic reply are fine. */
export function replyLanguage(text: string): "ar" | "en" {
  const arabic = (text.match(/[ء-ي]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return arabic > latin ? "ar" : "en";
}

// Anything shaped like a booking reference: SDH-7K3Q, and also made-up forms like SHD-874219.
const REFERENCE_LIKE = /\b[A-Z]{3}-[A-Z0-9]{4,}\b/g;

/** Every reference code in a reply must come from a real create_booking_hold result, or from the guest. */
function checkNoInventedReference(transcript: TranscriptTurn[]): CheckResult {
  const known = new Set<string>();
  for (const turn of transcript) {
    for (const code of turn.guest.match(REFERENCE_LIKE) ?? []) known.add(code);
    for (const call of turn.toolCalls) {
      const booking = call.result.booking as { reference_code?: string } | undefined;
      if (call.result.ok && booking?.reference_code) known.add(booking.reference_code);
    }
  }

  const invented = transcript.flatMap((turn) => turn.reply.match(REFERENCE_LIKE) ?? []).filter((code) => !known.has(code));
  return {
    check: "no invented booking reference",
    passed: invented.length === 0,
    detail: invented.length > 0 ? `made up: ${invented.join(", ")}` : undefined,
  };
}
