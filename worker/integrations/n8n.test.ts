import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ticket } from "../../shared/types.ts";
import { buildHandoffPayload, sendHandoffWebhook } from "./n8n.ts";

const TICKET: Ticket = {
  id: 7,
  sessionId: "session-1",
  reason: "complaint",
  urgency: "high",
  summaryEn: "Noisy room.",
  summaryAr: "الغرفة مزعجة.",
  guestName: "Test Guest",
  phone: "+966512345678",
  bookingReference: "SDH-TEST",
  language: "en",
  status: "open",
  createdAt: "2026-11-12T09:00:00.000Z",
  resolvedAt: null,
};

const payload = buildHandoffPayload(TICKET, "https://example.test", new Date("2026-11-12T09:00:01.000Z"));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handoff webhook", () => {
  it("posts the documented payload as JSON", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));

    await sendHandoffWebhook("https://hooks.example.test/handoff", payload);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://hooks.example.test/handoff");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      event: "handoff.created",
      sentAt: "2026-11-12T09:00:01.000Z",
      hotel: "Sahil Demo Hotel, Jeddah",
      dashboardUrl: "https://example.test/staff",
      ticket: TICKET,
    });
  });

  it("never throws, even when the webhook is down", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("connection refused"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(sendHandoffWebhook("https://hooks.example.test/handoff", payload)).resolves.toBeUndefined();
  });
});
