import { describe, expect, it } from "vitest";
import { detectLanguage, normalizeDigits, normalizeDigitsDeep } from "./text.ts";

describe("normalizeDigits", () => {
  it("converts Arabic-Indic digits", () => {
    expect(normalizeDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(normalizeDigits("٢٠٢٦-١١-١٣")).toBe("2026-11-13");
  });

  it("converts the Persian and Urdu digit forms too", () => {
    expect(normalizeDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });

  it("leaves the rest of the text alone", () => {
    expect(normalizeDigits("أبغى غرفة لـ ٣ ليالي من يوم 12")).toBe("أبغى غرفة لـ 3 ليالي من يوم 12");
    expect(normalizeDigits("room for 2 nights")).toBe("room for 2 nights");
    expect(normalizeDigits("")).toBe("");
  });
});

describe("normalizeDigitsDeep", () => {
  it("reaches strings nested inside objects and arrays", () => {
    const toolArgs = { guests: "٢", guest_details: { phone: "٠٥٥١٢٣٤٥٦٧" }, tags: ["غرفة ٥"] };
    expect(normalizeDigitsDeep(toolArgs)).toEqual({
      guests: "2",
      guest_details: { phone: "0551234567" },
      tags: ["غرفة 5"],
    });
  });

  it("passes other values through unchanged", () => {
    expect(normalizeDigitsDeep({ guests: 2, confirmed: true, notes: null })).toEqual({
      guests: 2,
      confirmed: true,
      notes: null,
    });
    expect(normalizeDigitsDeep(undefined)).toBeUndefined();
  });
});

describe("detectLanguage", () => {
  it("recognizes Arabic", () => {
    expect(detectLanguage("عندكم غرف فاضية الويكند الجاي لشخصين؟")).toBe("ar");
  });

  it("recognizes English", () => {
    expect(detectLanguage("What time is check-in, and do you have airport pickup?")).toBe("en");
  });

  it("recognizes Arabic and English mixed in one sentence", () => {
    expect(detectLanguage("أبغى أحجز suite لثلاث ليالي من الخميس")).toBe("mixed");
  });

  it("does not call a message Arabic because of Arabic digits or punctuation alone", () => {
    expect(detectLanguage("2 nights؟")).toBe("en");
    expect(detectLanguage("٣")).toBe("en");
  });
});
