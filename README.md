# Sahil Demo Hotel: bilingual AI receptionist (demo)

> **Demo, fictional hotel.** "Sahil Demo Hotel, Jeddah" does not exist. Every name, price, phone number and booking in this repository is made up.

A web demo of an AI receptionist that chats with hotel guests in Saudi Arabic dialect, English, or both in one sentence. It answers questions from the hotel's knowledge base, checks room availability, creates booking holds, and hands off to staff with a short summary in both languages.

**Status: work in progress.** The data layer, the four tools, the Gemini tool loop, `/api/chat` and the bilingual chat page are built, tested and evaluated. Deployment and the staff dashboard come next. The plan and the design decisions are in [docs/PLAN.md](docs/PLAN.md).

## Evals

25 scripted conversations ([evals/cases.json](evals/cases.json)) in English, Hijazi, Najdi, formal Arabic and mixed Arabic/English. They cover relative dates, Arabic digits, typos, FAQs, availability, full booking flows, handoffs and prompt injection. Each run uses the real Gemini API, a fresh copy of the demo hotel, and a clock frozen on one date, so "بكرة" (tomorrow) and "next Friday" have exactly one right answer. Grading is deterministic, with no AI judge: tool calls and their arguments, forbidden actions, reply language, key facts, and no invented booking reference.

| Run (`gemini-3.5-flash-lite`) | Passed | Report |
|---|---|---|
| Baseline | 20/25 | [results-baseline.md](evals/results-baseline.md) |
| After two prompt fixes | **25/25** | [results.md](evals/results.md) |

What the baseline caught, and the fixes:
- **Arabic replies to English guests** (3 cases). The guest's language is now detected in code and the prompt states it outright: "reply in English only".
- **Wrong dates** for "الويكند الجاي" (next weekend) and "next Friday" (2 cases). The prompt now includes those dates already worked out, as it already did with a calendar.

Earlier manual runs found two worse failures, now fixed in code and checked by every eval case:
- **The model invented a booking reference.** Tool results had been put back into the history as text, and the model imitated that text instead of calling the tool. Earlier tool calls are now replayed in Gemini's own function-call format.
- **The model booked before the guest confirmed.** The booking tool now refuses if the guest's phone number is in the message being answered, since the details can't have been read back yet.

Results are from single runs, and the model is not deterministic: rerun to check stability.

```bash
npm run eval                                           # all cases
npm run eval -- --only=handoff-manager-en              # some cases
npm run eval -- --model=gemini-3.8-flash --thinking=low --out=evals/results-3.8.md
```

## Stack

React, TypeScript, Vite and Tailwind CSS on the front end. One Cloudflare Worker (Hono) serves the app and the `/api` routes, with Cloudflare D1 (SQLite) for data. Google Gemini with function calling for the assistant. Vitest for tests.

## Run it locally

Needs Node.js 24 or newer.

```bash
npm install
npm run db:migrate   # create the tables in the local D1 database
npm run db:seed      # load the demo data
npm test             # run the tests
npm run dev          # http://localhost:5173
```

Call one of the assistant's tools by hand, to see exactly what the AI receives:

```bash
npm run tool -- check_availability check_in=+1 check_out=+3 guests=2
```

`+1` means one day from today in Riyadh. More examples are at the top of [scripts/try-tool.ts](scripts/try-tool.ts).

Chat with the assistant from the terminal (needs a Gemini API key in `.dev.vars`; copy `.dev.vars.example`):

```bash
npm run chat
```
