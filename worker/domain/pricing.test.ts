import { describe, expect, it } from "vitest";
import { halalasToSar, stayTotalHalalas, vatIncludedHalalas } from "./pricing.ts";

describe("stayTotalHalalas", () => {
  it("multiplies the nightly rate by nights and rooms", () => {
    expect(stayTotalHalalas(69_000, 2, 1)).toBe(138_000); // SAR 690 x 2 nights
    expect(stayTotalHalalas(46_000, 3, 2)).toBe(276_000); // SAR 460 x 3 nights x 2 rooms
  });
});

describe("vatIncludedHalalas", () => {
  it("takes the VAT out of a VAT-inclusive price (15 parts of 115, not 15 of 100)", () => {
    // SAR 1,380 including VAT is SAR 1,200 plus SAR 180 VAT. A naive 15% of 1,380 would say 207.
    expect(vatIncludedHalalas(138_000)).toBe(18_000);
    expect(vatIncludedHalalas(46_000)).toBe(6_000);
  });

  it("rounds to the nearest halala when the split is not exact", () => {
    // SAR 100.00 including VAT: 10000 x 15 / 115 = 1304.35 halalas
    expect(vatIncludedHalalas(10_000)).toBe(1_304);
  });

  it("is zero for a zero amount", () => {
    expect(vatIncludedHalalas(0)).toBe(0);
  });
});

describe("halalasToSar", () => {
  it("converts for display", () => {
    expect(halalasToSar(138_000)).toBe(1380);
    expect(halalasToSar(11_550)).toBe(115.5);
  });
});
