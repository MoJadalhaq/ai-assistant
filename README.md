# Sahil Demo Hotel: bilingual AI receptionist (demo)

> **Demo, fictional hotel.** "Sahil Demo Hotel, Jeddah" does not exist. Every name, price, phone number and booking in this repository is made up.

A web demo of an AI receptionist that chats with hotel guests in Saudi Arabic dialect, English, or both in one sentence. It answers questions from the hotel's knowledge base, checks room availability, creates booking holds, and hands off to staff with a short summary in both languages.

**Status: work in progress.** The data layer and the assistant's four tools are built and tested. The chat endpoint, guest UI and staff dashboard come next. The plan and the design decisions are in [docs/PLAN.md](docs/PLAN.md).

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
