import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  findStayProblem,
  FRIDAY,
  isIsoDate,
  nextWeekday,
  riyadhToday,
  THURSDAY,
  weekdayOf,
} from "./dates.ts";

describe("riyadhToday", () => {
  it("is three hours ahead of UTC, so the date changes at 21:00 UTC", () => {
    expect(riyadhToday(new Date("2026-11-11T20:59:59Z"))).toBe("2026-11-11");
    expect(riyadhToday(new Date("2026-11-11T21:00:00Z"))).toBe("2026-11-12");
  });

  it("rolls over the year correctly", () => {
    expect(riyadhToday(new Date("2026-12-31T22:30:00Z"))).toBe("2027-01-01");
  });
});

describe("isIsoDate", () => {
  it("accepts real dates written as YYYY-MM-DD", () => {
    expect(isIsoDate("2026-11-13")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true); // leap year
  });

  it("rejects dates that do not exist", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-02-29")).toBe(false); // not a leap year
    expect(isIsoDate("2026-13-01")).toBe(false);
  });

  it("rejects other formats", () => {
    expect(isIsoDate("13/11/2026")).toBe(false);
    expect(isIsoDate("2026-1-5")).toBe(false);
    expect(isIsoDate("next Thursday")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("date arithmetic", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-29", 3)).toBe("2026-12-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-11-11", -11)).toBe("2026-10-31");
  });

  it("counts the days between two dates", () => {
    expect(daysBetween("2026-11-12", "2026-11-14")).toBe(2);
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(daysBetween("2026-11-14", "2026-11-12")).toBe(-2);
  });

  it("knows the day of the week", () => {
    expect(weekdayOf("2026-11-12")).toBe(THURSDAY);
    expect(weekdayOf("2026-11-13")).toBe(FRIDAY);
  });
});

describe("nextWeekday", () => {
  it("finds the coming Thursday", () => {
    expect(nextWeekday("2026-11-11", THURSDAY)).toBe("2026-11-12"); // from a Wednesday
  });

  it("returns the same day when it already is that weekday", () => {
    expect(nextWeekday("2026-11-12", THURSDAY)).toBe("2026-11-12");
  });

  it("goes to next week when the weekday has just passed", () => {
    expect(nextWeekday("2026-11-13", THURSDAY)).toBe("2026-11-19"); // from a Friday
  });
});

describe("findStayProblem", () => {
  const today = "2026-11-11";

  it("accepts a normal stay, including one that starts today", () => {
    expect(findStayProblem("2026-11-12", "2026-11-14", today)).toBeNull();
    expect(findStayProblem(today, "2026-11-12", today)).toBeNull();
  });

  it("rejects a check-in before today", () => {
    expect(findStayProblem("2026-11-10", "2026-11-12", today)).toBe("check_in_in_past");
  });

  it("rejects a check-out on or before the check-in", () => {
    expect(findStayProblem("2026-11-12", "2026-11-12", today)).toBe("check_out_not_after_check_in");
    expect(findStayProblem("2026-11-14", "2026-11-12", today)).toBe("check_out_not_after_check_in");
  });

  it("allows 14 nights but not 15", () => {
    expect(findStayProblem("2026-11-12", "2026-11-26", today)).toBeNull();
    expect(findStayProblem("2026-11-12", "2026-11-27", today)).toBe("stay_too_long");
  });

  it("allows a check-in 365 days ahead but not 366", () => {
    expect(findStayProblem("2027-11-11", "2027-11-12", today)).toBeNull();
    expect(findStayProblem("2027-11-12", "2027-11-13", today)).toBe("too_far_ahead");
  });
});
