import { describe, expect, it } from "vitest";
import { maskPhone, maskPhonesInText, normalizePhone } from "./phone.ts";

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

describe("maskPhone", () => {
  it("keeps the country code, the first digit and the last three digits", () => {
    expect(maskPhone("+966512345678")).toBe("+9665•••••678");
    expect(maskPhone("+447700900123")).toBe("+4477•••••123");
  });

  it("hides most of a number kept as the guest typed it", () => {
    expect(maskPhone("0551234567")).toBe("055••••567");
  });

  it("hides anything too short to be a phone number completely", () => {
    expect(maskPhone("12345")).toBe("•••••");
  });
});

describe("maskPhonesInText", () => {
  it("masks a number the AI copied into a summary", () => {
    expect(maskPhonesInText("Guest Omar (0551112233) wants the manager.")).toBe("Guest Omar (055••••233) wants the manager.");
  });

  it("masks numbers written with spaces, a country code or Arabic digits", () => {
    expect(maskPhonesInText("call +966 55 111 2233")).toBe("call +9665•••••233");
    expect(maskPhonesInText("رقمه ٠٥٥١١١٢٢٣٣")).toBe("رقمه 055••••233");
  });

  it("leaves dates, prices, counts and booking references alone", () => {
    const text = "6 rooms from 2026-11-20 2026-11-22, 1380 SAR, booking SDH-M8YC";
    expect(maskPhonesInText(text)).toBe(text);
  });
});
