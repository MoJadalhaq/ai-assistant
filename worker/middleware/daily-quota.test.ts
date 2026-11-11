import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { takeDailyQuota } from "./daily-quota.ts";

// Each test uses its own day, so counters from one test don't leak into another.
const limits = { perVisitor: 2, total: 3 };

describe("takeDailyQuota", () => {
  it("lets a visitor send up to their daily limit, then refuses until Riyadh midnight", async () => {
    const now = new Date("2026-12-01T20:00:00Z"); // 23:00 in Riyadh

    expect(await takeDailyQuota(env.DB, "1.1.1.1", limits, now)).toEqual({ allowed: true });
    expect(await takeDailyQuota(env.DB, "1.1.1.1", limits, now)).toEqual({ allowed: true });
    expect(await takeDailyQuota(env.DB, "1.1.1.1", limits, now)).toEqual({
      allowed: false,
      scope: "visitor",
      retryAfterSeconds: 3600,
    });
  });

  it("caps the total for all visitors together", async () => {
    const now = new Date("2026-12-02T09:00:00Z");

    for (const visitor of ["a", "b", "c"]) {
      expect((await takeDailyQuota(env.DB, visitor, limits, now)).allowed).toBe(true);
    }
    expect(await takeDailyQuota(env.DB, "d", limits, now)).toMatchObject({ allowed: false, scope: "total" });
  });

  it("does not let a blocked visitor use up everyone else's budget", async () => {
    const now = new Date("2026-12-03T09:00:00Z");

    for (let i = 0; i < 10; i++) await takeDailyQuota(env.DB, "spammer", limits, now);

    // The spammer got 2 messages through; the other visitor still has room in the total of 3.
    expect((await takeDailyQuota(env.DB, "guest", limits, now)).allowed).toBe(true);
  });

  it("starts fresh on a new day in Riyadh", async () => {
    const lateEvening = new Date("2026-12-04T20:59:00Z"); // 23:59 in Riyadh
    const afterMidnight = new Date("2026-12-04T21:00:00Z"); // 00:00 the next day

    await takeDailyQuota(env.DB, "early-bird", limits, lateEvening);
    await takeDailyQuota(env.DB, "early-bird", limits, lateEvening);
    expect((await takeDailyQuota(env.DB, "early-bird", limits, lateEvening)).allowed).toBe(false);
    expect((await takeDailyQuota(env.DB, "early-bird", limits, afterMidnight)).allowed).toBe(true);
  });
});
