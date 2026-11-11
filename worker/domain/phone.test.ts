import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone.ts";

describe("normalizePhone", () => {
  it.each([
    ["0551234567", "+966551234567"], // local form
    ["551234567", "+966551234567"], // leading zero dropped
    ["+966551234567", "+966551234567"], // already international
    ["966551234567", "+966551234567"], // country code without the plus
    ["00966551234567", "+966551234567"], // 00 prefix
    ["+9660551234567", "+966551234567"], // country code and the local zero together
    ["055 123 4567", "+966551234567"], // spaces
    ["055-123-4567", "+966551234567"], // dashes
    ["(055) 123.4567", "+966551234567"], // brackets and dots
    ["٠٥٥١٢٣٤٥٦٧", "+966551234567"], // Arabic digits
    ["+٩٦٦ ٥٥ ١٢٣ ٤٥٦٧", "+966551234567"], // Arabic digits, international
  ])("writes the Saudi mobile %s as %s", (given, expected) => {
    expect(normalizePhone(given)).toBe(expected);
  });

  it("accepts numbers from other countries when they include the country code", () => {
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalizePhone("0044 7700 900123")).toBe("+447700900123");
    expect(normalizePhone("+971 50 123 4567")).toBe("+971501234567");
  });

  it.each([
    ["055123456"], // one digit short
    ["05512345678"], // one digit too many
    ["+96655123456"], // Saudi country code, one digit short
    ["12345"], // far too short
    ["07700900123"], // foreign number without a country code
    ["my number"],
    [""],
  ])("rejects %s", (given) => {
    expect(normalizePhone(given)).toBeNull();
  });
});
