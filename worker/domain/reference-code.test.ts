import { describe, expect, it } from "vitest";
import { generateReferenceCode, isReferenceCode } from "./reference-code.ts";

describe("generateReferenceCode", () => {
  it("produces codes like SDH-7K3Q", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateReferenceCode()).toMatch(/^SDH-[A-Z2-9]{4}$/);
    }
  });

  it("never uses characters that are easy to confuse (0, O, 1, I, L)", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateReferenceCode().slice(4)).not.toMatch(/[0O1IL]/);
    }
  });

  it("is random: 50 codes are not all the same", () => {
    const codes = new Set(Array.from({ length: 50 }, generateReferenceCode));
    expect(codes.size).toBeGreaterThan(40);
  });
});

describe("isReferenceCode", () => {
  it("accepts generated codes and rejects everything else", () => {
    expect(isReferenceCode(generateReferenceCode())).toBe(true);
    expect(isReferenceCode("SDH-K7M2")).toBe(true);
    expect(isReferenceCode("SDH-K7M")).toBe(false);
    expect(isReferenceCode("SDH-K0M2")).toBe(false);
    expect(isReferenceCode("sdh-k7m2")).toBe(false);
    expect(isReferenceCode("ABC-K7M2")).toBe(false);
  });
});
