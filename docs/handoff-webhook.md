# Handoff webhook (optional, for n8n or similar)

When the assistant hands a conversation to staff, the Worker can also send the ticket to a webhook,
so the team gets a WhatsApp, Slack or email alert instead of watching the dashboard.
It is off unless the `N8N_WEBHOOK_URL` secret is set.

## Turn it on

1. In n8n, add a **Webhook** node (HTTP method `POST`) and copy its production URL.
2. Store the URL as a secret. It isn't committed, since anyone with the URL could post fake tickets:
   ```bash
   npx wrangler secret put N8N_WEBHOOK_URL
   ```
   For local development, add `N8N_WEBHOOK_URL=...` to `.dev.vars` instead.

## When it is sent

Once per ticket, right after the guest gets their reply (`ctx.waitUntil`), so a slow or broken
webhook never delays the chat. It gives up after 5 seconds and is not retried; failures are logged.
The dashboard still shows every ticket either way.

## Payload

`POST` with `content-type: application/json`:

```json
{
  "event": "handoff.created",
  "sentAt": "2026-11-12T09:00:01.000Z",
  "hotel": "Sahil Demo Hotel, Jeddah",
  "dashboardUrl": "https://<your-worker>/staff",
  "ticket": {
    "id": 7,
    "sessionId": "c0a8e1d2-...",
    "reason": "complaint",
    "urgency": "high",
    "summaryEn": "Guest says the room is dirty and wants the manager.",
    "summaryAr": "الضيف يقول إن الغرفة غير نظيفة ويطلب المدير.",
    "guestName": "Omar",
    "phone": "+966551112233",
    "bookingReference": "SDH-M8YC",
    "language": "mixed",
    "status": "open",
    "createdAt": "2026-11-12T09:00:00.000Z",
    "resolvedAt": null
  }
}
```

| Field | Values |
|---|---|
| `reason` | `human_request`, `complaint`, `out_of_scope`, `group_booking`, `special_pricing`, `medical_or_accessibility`, `other` |
| `urgency` | `low`, `normal`, `high` |
| `language` | `ar`, `en`, `mixed` (the guest's writing) |
| `guestName`, `phone`, `bookingReference` | `null` when the guest didn't give them |

Unlike the public dashboard, the phone number here is **not** masked: the webhook goes to the hotel's
own systems, and staff need the number to call the guest back.

The shape is defined in `worker/integrations/n8n.ts` and checked by `worker/integrations/n8n.test.ts`.
