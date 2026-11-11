import { isRecord, normalizeDigitsDeep } from "../../shared/text.ts";
import { isIsoDate } from "../domain/dates.ts";
import { fail } from "./tool-types.ts";
import type { ToolFailure } from "./tool-types.ts";

/**
 * Reads and checks the arguments the model sent to a tool.
 *
 * The model's arguments are untrusted input, exactly like a web form: a field can be missing,
 * the wrong type, or an impossible date. Each reader returns a value and, when the value is bad,
 * adds a line to `problems`. A tool reads all its arguments first and uses them only if
 * `problems` is still empty. Reporting every problem at once lets the model fix them in one retry.
 */
export class ArgReader {
  readonly problems: string[] = [];
  private readonly args: Record<string, unknown>;

  constructor(rawArgs: unknown) {
    // Digits are normalized before anything else, so "٢" works as a number and "٢٠٢٦-١١-١٣" as a date.
    const normalized = normalizeDigitsDeep(rawArgs);
    this.args = isRecord(normalized) ? normalized : {};
  }

  has(name: string): boolean {
    const value = this.args[name];
    return value !== undefined && value !== null && value !== "";
  }

  string(name: string, maxLength: number): string {
    const value = this.args[name];
    if (typeof value !== "string" || value.trim() === "") {
      this.problems.push(`${name}: required, as text`);
      return "";
    }
    const text = value.trim();
    if (text.length > maxLength) this.problems.push(`${name}: too long, at most ${maxLength} characters`);
    return text;
  }

  optionalString(name: string, maxLength: number): string | null {
    return this.has(name) ? this.string(name, maxLength) : null;
  }

  integer(name: string, min: number, max: number): number {
    const value = this.args[name];
    // Models sometimes send numbers as text ("2"), so both forms are accepted.
    const number = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value;
    if (typeof number !== "number" || !Number.isInteger(number) || number < min || number > max) {
      this.problems.push(`${name}: required, a whole number from ${min} to ${max}`);
      return min;
    }
    return number;
  }

  optionalInteger(name: string, min: number, max: number): number | null {
    return this.has(name) ? this.integer(name, min, max) : null;
  }

  date(name: string): string {
    const value = this.args[name];
    const text = typeof value === "string" ? value.trim() : "";
    if (!isIsoDate(text)) {
      this.problems.push(`${name}: required, a real calendar date written as YYYY-MM-DD`);
    }
    return text;
  }

  boolean(name: string): boolean {
    const value = this.args[name];
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    this.problems.push(`${name}: required, true or false`);
    return false;
  }
}

export function invalidArguments(problems: string[]): ToolFailure {
  return fail("invalid_arguments", `Fix these arguments and call the tool again: ${problems.join("; ")}`, {
    problems,
  });
}
