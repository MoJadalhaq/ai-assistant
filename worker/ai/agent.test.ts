// Tests the tool loop with a scripted fake model, so they are fast, free and repeatable.
// How well the real model behaves is the evals' job, not these tests'.

import type { Content, FunctionCall } from "@google/genai";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../data/memory-repository.ts";
import { buildSeedData } from "../data/seed.ts";
import type { ToolContext } from "../tools/index.ts";
import { MAX_MODEL_CALLS, runAgent } from "./agent.ts";
import type { ModelClient, ModelRequest, ModelTurn } from "./gemini.ts";

const NOW = new Date("2026-11-11T09:00:00Z");

/** A model that plays back prepared turns and records every request it gets. */
function scriptedModel(turns: ModelTurn[]): ModelClient & { requests: ModelRequest[] } {
  const requests: ModelRequest[] = [];
  return {
    requests,
    async generate(request) {
      requests.push({ ...request, contents: [...request.contents] });
      const turn = turns.shift();
      if (!turn) throw new Error("The scripted model ran out of turns");
      return turn;
    },
  };
}

function says(text: string): ModelTurn {
  return { content: { role: "model", parts: [{ text }] }, functionCalls: [], text };
}

function calls(...functionCalls: FunctionCall[]): ModelTurn {
  const content: Content = { role: "model", parts: functionCalls.map((functionCall) => ({ functionCall })) };
  return { content, functionCalls, text: "" };
}

let ctx: ToolContext;

beforeEach(async () => {
  const repo = new MemoryRepository();
  await repo.replaceAllData(buildSeedData("2026-11-11", NOW.toISOString()));
  ctx = { repo, now: NOW, sessionId: "session-1", language: "en" };
});

describe("runAgent", () => {
  it("returns the reply directly when the model calls no tool", async () => {
    const model = scriptedModel([says("Hello! How can I help?")]);

    const result = await runAgent({ model, history: [], message: "hi", ctx });

    expect(result).toMatchObject({ reply: "Hello! How can I help?", events: [], toolCalls: [] });
    expect(model.requests).toHaveLength(1);
  });

  it("runs the requested tool and sends the result back to the model", async () => {
    const model = scriptedModel([
      calls({ id: "call-1", name: "get_hotel_info", args: { topic: "parking" } }),
      says("Parking is free."),
    ]);

    const result = await runAgent({ model, history: [], message: "Is parking free?", ctx });

    expect(result.reply).toBe("Parking is free.");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.result.ok).toBe(true);

    // Second request: the model's own function call, then our result for that call.
    const [, modelTurn, toolTurn] = model.requests[1]!.contents;
    expect(modelTurn?.role).toBe("model");
    expect(toolTurn?.parts?.[0]?.functionResponse).toMatchObject({ id: "call-1", name: "get_hotel_info" });
  });

  it("turns a booking into a card event", async () => {
    const model = scriptedModel([
      calls({
        name: "create_booking_hold",
        args: {
          name: "Sara Ahmed",
          phone: "0551234567",
          room_type: "deluxe-sea",
          check_in: "2026-11-12",
          check_out: "2026-11-14",
          guests: 2,
          guest_confirmed: true,
        },
      }),
      says("Done! Your reference is on the card."),
    ]);

    const result = await runAgent({ model, history: [], message: "Yes, book it", ctx });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ type: "booking_created", booking: { room_type: "deluxe-sea", total_sar: 1380 } });
  });

  it("turns a handoff into a ticket event", async () => {
    const model = scriptedModel([
      calls({
        name: "handoff_to_staff",
        args: { reason: "human_request", urgency: "normal", summary_en: "Wants a manager.", summary_ar: "يطلب المدير." },
      }),
      says("I've passed you to the team."),
    ]);

    const result = await runAgent({ model, history: [], message: "manager please", ctx });

    expect(result.events[0]).toMatchObject({ type: "ticket_created", ticket: { reason: "human_request" } });
  });

  it("replays earlier tool calls as real function calls, never as text the model could imitate", async () => {
    const model = scriptedModel([says("Sure.")]);
    const history = [
      { role: "user" as const, text: "rooms for the weekend?" },
      {
        role: "assistant" as const,
        text: "Deluxe is SAR 1,380.",
        toolCalls: [{ name: "check_availability", args: { guests: 2 }, result: { ok: true, options: [] } }],
      },
    ];

    await runAgent({ model, history, message: "book the deluxe", ctx });

    const contents = model.requests[0]!.contents;
    // guest, model's tool call, tool result, model's reply, new guest message
    expect(contents.map((content) => content.role)).toEqual(["user", "model", "user", "model", "user"]);
    expect(contents[1]?.parts?.[0]).toMatchObject({
      functionCall: { name: "check_availability", args: { guests: 2 } },
      thoughtSignature: "skip_thought_signature_validator",
    });
    expect(contents[2]?.parts?.[0]?.functionResponse).toMatchObject({ name: "check_availability" });
    expect(contents[3]?.parts).toEqual([{ text: "Deluxe is SAR 1,380." }]);
  });

  it("normalizes Arabic digits in the guest's message", async () => {
    const model = scriptedModel([says("تمام")]);

    await runAgent({ model, history: [], message: "غرفة لـ ٢ أشخاص", ctx });

    expect(model.requests[0]!.contents[0]?.parts?.[0]?.text).toBe("غرفة لـ 2 أشخاص");
  });

  it("gives up with a polite reply when the model keeps calling tools", async () => {
    const endless = Array.from({ length: MAX_MODEL_CALLS + 1 }, () =>
      calls({ name: "get_hotel_info", args: { topic: "wifi" } }),
    );
    const model = scriptedModel(endless);

    const result = await runAgent({ model, history: [], message: "hi", ctx });

    expect(model.requests).toHaveLength(MAX_MODEL_CALLS);
    expect(result.reply).toContain("Sorry");
  });
});
