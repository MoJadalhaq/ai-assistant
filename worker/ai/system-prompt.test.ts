import { describe, expect, it } from "vitest";
import { buildCalendar, buildSystemPrompt, resolvedDatePhrases } from "./system-prompt.ts";

describe("buildCalendar", () => {
  it("starts today, labels the first three days and names weekdays in both languages", () => {
    const lines = buildCalendar("2026-11-11").split("\n");
    expect(lines).toHaveLength(15);
    expect(lines[0]).toBe("2026-11-11  Wednesday / الأربعاء  (today / اليوم)");
    expect(lines[1]).toContain("(tomorrow / بكرة)");
    expect(lines[2]).toBe("2026-11-13  Friday / الجمعة  (day after tomorrow / بعد بكرة)");
  });
});

describe("resolvedDatePhrases", () => {
  it("on a Wednesday, the weekend is the coming Thursday to Saturday", () => {
    expect(resolvedDatePhrases("2026-11-11")).toContain("check-in 2026-11-12, check-out 2026-11-14");
  });

  it("on a Thursday, the weekend starts today", () => {
    expect(resolvedDatePhrases("2026-11-12")).toContain("check-in 2026-11-12, check-out 2026-11-14");
  });

  it("on a Friday, only tonight is left of the weekend", () => {
    expect(resolvedDatePhrases("2026-11-13")).toContain("check-in 2026-11-13, check-out 2026-11-14");
  });

  it("on a Saturday, the weekend is the next Thursday to Saturday", () => {
    expect(resolvedDatePhrases("2026-11-14")).toContain("check-in 2026-11-19, check-out 2026-11-21");
  });

  it("maps every weekday name to the first one after today, never today itself", () => {
    const phrases = resolvedDatePhrases("2026-11-11"); // Wednesday
    expect(phrases).toContain("Thursday / الخميس = 2026-11-12");
    expect(phrases).toContain("Friday / الجمعة = 2026-11-13");
    expect(phrases).toContain("Wednesday / الأربعاء = 2026-11-18");
  });
});

describe("buildSystemPrompt", () => {
  const now = new Date("2026-11-11T09:00:00Z");

  it("tells the model which language to reply in, based on the guest's latest message", () => {
    expect(buildSystemPrompt(now, "en")).toContain("reply in English only");
    expect(buildSystemPrompt(now, "ar")).toContain("reply in Arabic");
    expect(buildSystemPrompt(now, "mixed")).toContain("keeping the English words");
  });

  it("includes today's date and time in Riyadh", () => {
    expect(buildSystemPrompt(now, "en")).toContain("Wednesday 2026-11-11, 12:00");
  });
});
