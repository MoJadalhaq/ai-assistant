// Optional: tells an outside automation (n8n, or anything that accepts a webhook) about each handoff,
// so staff can be alerted on WhatsApp, Slack or email without watching the dashboard.
// Switched on by setting the N8N_WEBHOOK_URL secret. The payload is documented in docs/handoff-webhook.md.

import type { Ticket } from "../../shared/types.ts";
import { HOTEL_NAME_EN } from "../data/hotel-kb.ts";

const TIMEOUT_MS = 5000;

export interface HandoffWebhookPayload {
  event: "handoff.created";
  /** UTC, ISO 8601. */
  sentAt: string;
  hotel: string;
  dashboardUrl: string;
  /** The full ticket, phone number included: the webhook goes to the hotel's own systems. */
  ticket: Ticket;
}

export function buildHandoffPayload(ticket: Ticket, origin: string, now: Date): HandoffWebhookPayload {
  return {
    event: "handoff.created",
    sentAt: now.toISOString(),
    hotel: HOTEL_NAME_EN,
    dashboardUrl: `${origin}/staff`,
    ticket,
  };
}

/**
 * Sends the payload and never throws. It runs after the guest has their reply (ctx.waitUntil),
 * so a slow or broken webhook can't delay or break the chat; failures only go to the logs.
 */
export async function sendHandoffWebhook(url: string, payload: HandoffWebhookPayload): Promise<void> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) console.error(`Handoff webhook answered ${response.status} for ticket ${payload.ticket.id}`);
  } catch (error) {
    console.error(`Handoff webhook failed for ticket ${payload.ticket.id}:`, error);
  }
}
