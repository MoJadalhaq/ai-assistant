import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { D1Repository } from "./data/d1-repository.ts";
import { ROOM_TYPES } from "./data/hotel-kb.ts";
import { app } from "./index.ts";

describe("GET /api/health", () => {
  it("reports that the API and the database are up", async () => {
    await new D1Repository(env.DB).replaceAllData({ rooms: ROOM_TYPES, bookings: [], tickets: [] });

    const response = await app.request("/api/health", {}, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, roomTypes: ROOM_TYPES.length });
  });
});

describe("unknown API paths", () => {
  it("answer with a JSON 404", async () => {
    const response = await app.request("/api/nothing-here", {}, env);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: "not_found" });
  });
});
