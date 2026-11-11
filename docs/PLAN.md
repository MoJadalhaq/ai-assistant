# Sahil Demo Hotel: AI Receptionist (project plan)

> Demo project. **Sahil Demo Hotel, Jeddah is fictional.** All names, prices, phone numbers and bookings in this repo are made up.

Status: **Phase 2a (AI core) is done.** Next: Phase 2b (evals and the daily quota cap). This file is the reference for decisions; it is updated when a decision changes.

| Phase | What | Status |
|---|---|---|
| 0 | Plan | Done |
| 1 | Data + tools | Done |
| 2a | Tool loop, system prompt, `/api/chat`, burst rate limit, terminal chat | Done |
| 2b | Evals (`evals/cases.json`, `npm run eval`), daily quota cap in D1 | Next |

**Findings from the first real runs (Phase 2a):**
- Writing earlier tool results into the history as *text* made the model imitate that text and report a booking it never made, with an invented reference. Earlier tool calls are now replayed as real function-call parts (decision 19). The 2b evals must include a "no booking without a tool call" check.
- `gemini-3.5-flash-lite` read "الويكند الجاي" as Friday to Sunday despite the prompt's Thursday-to-Saturday rule. An eval case covers it; trying `thinkingLevel: "low"` is the first fix to test.
- The free-tier model returns 503 "high demand" at times. The adapter retries once, then answers "busy, try again".
| 3 | Guest UI + first deploy | |
| 4 | Staff dashboard, daily reset, optional auth and n8n | |
| 5 | Voice (stretch) | |
| 6 | README, architecture doc, demo script | |

---

## 1. Working agreement

- Built in phases. After each phase: stop and wait for a go-ahead, summarize changed files, explain the 3 to 5 most important pieces of code, give exact run/test steps, and commit.
- Simple, explicit code. Small functions, clear names, comments explain *why*.
- Every new dependency is named and justified before it is added.
- Setup code is checked against the current official docs first (findings below).
- No secrets in git: `.dev.vars` locally (git-ignored), `wrangler secret put` in production, `.dev.vars.example` committed.
- Public repo: fictional data only, no real employer, client or company named anywhere.

---

## 2. What the current docs say (checked 2026-11-10/11)

These findings changed or confirmed parts of the brief.

**Cloudflare**
- A **single Worker serving the built React app (static assets) plus `/api` routes, built with `@cloudflare/vite-plugin`, is the documented pattern** for an SPA with an API (React SPA tutorial and React framework guide). Config: `assets.not_found_handling: "single-page-application"` and `assets.run_worker_first: ["/api/*"]`. Local dev runs through `vite dev`, not `wrangler dev`. So the brief's preferred setup stands.
- The project config mirrors **Cloudflare's current React template** (generated with `create-cloudflare` on 2026-11-11): TypeScript 7, Vite 8, imports written with `.ts` extensions, `verbatimModuleSyntax` and `erasableSyntaxOnly`. Those last three also let Node 24 run the same TypeScript files directly, which the scripts and (in Phase 2) the evals rely on.
- D1 migrations: `wrangler d1 migrations create <db> <name>`, then `wrangler d1 migrations apply <db> --local|--remote`. Default folder `migrations/`, tracking table `d1_migrations`.
- Cron Triggers run on **UTC**. Local test endpoint: `/cdn-cgi/local/scheduled` (Vite plugin 1.60+).
- **Rate limiting binding** (`ratelimits` in the Wrangler config, Wrangler 4.36+): period must be **10 or 60 seconds**; counts are **per Cloudflare location and approximate**. The docs advise against IP-based keys because IPs can be shared; for anonymous guests the IP is the only identifier we have, so we accept that and add a daily cap in D1 (see decision 10).
- Tests: Cloudflare now ships **`@cloudflare/vitest-plugin`** (`cloudflareTest()` Vite plugin, which replaces `@cloudflare/vitest-pool-workers`). Supports Vitest `^4.1 || ^5`. D1 migrations are applied in tests with `readD1Migrations` + `applyD1Migrations`.
- GitHub push-to-deploy: **Workers Builds** (dashboard → connect repo). Default deploy command `npx wrangler deploy`. The dashboard Worker name must match `name` in `wrangler.jsonc`.
- Secrets: `.dev.vars` (if present, `.env` is ignored); production with `npx wrangler secret put <KEY>`.

**Gemini** (the docs moved from `ai.google.dev` to `aistudio.google.com/docs`)
- Current fast models (all **stable**): `gemini-3.8-flash` (GA Sep 2026), `gemini-3.6-flash`, `gemini-3.5-flash-lite` (GA Jul 2026). `gemini-2.5-flash` is deprecated and auto-routes to 3.5 Flash-Lite from 2026-12-01.
- All three have a **free tier**. On the free tier, **content may be used to improve Google's products**, so the UI must tell testers to use made-up names and numbers.
- Per-model free-tier RPM/RPD limits are **not published on the docs pages** (they're shown per project in AI Studio). A developer-forum report says 3.8 Flash's free tier is about 20 requests/day, which would be far too low for a public demo plus evals.
- The **Interactions API is GA (June 2026) and "recommended for all new projects"**; `generateContent` is labelled **"legacy" but "fully supported"**. Both are free on the free tier.
- Gemini 3.x function calling uses **thought signatures**: within the current turn, the model's function-call parts must be sent back exactly as received (the SDK handles this when the full model content is appended to history). Earlier turns can be plain text.
- Gemini 3.6+ ignore `temperature` / `top_p` / `top_k`, so we won't set them.
- Thinking defaults: 3.8 Flash = medium (low/medium/high); 3.5 Flash-Lite = minimal. Lower thinking means lower latency; the evals will pick the level.
- Audio input supports `audio/webm` and `audio/m4a`/`audio/aac` inline (20 MB request cap), which covers `MediaRecorder` in Chrome and Safari (Phase 5).
- `@google/genai` 3.1.0 requires Node 22+. Running it inside the Workers runtime isn't documented either way, so Phase 2 starts with a short spike to confirm it.

**Firebase** (Phase 4): verify the ID token's RS256 signature against Google's securetoken public keys, `aud` = project ID, `iss` = `https://securetoken.google.com/<projectId>`, plus `exp`, `iat`, `auth_time`, `sub`.

---

## 3. Key design decisions

1. **One Worker** (Hono) serves the SPA and `/api/*`, plus a `scheduled()` handler for the daily reset (Phase 4).
2. **Model access behind a thin adapter** (`worker/ai/gemini.ts`), using `generateContent`, so the tool loop doesn't depend on which Gemini endpoint we call.
3. **Stateless chat.** The browser keeps the conversation and sends the last ~12 turns with each request: user/assistant text, plus a compact note of earlier tool results so the model remembers what it offered. The Worker runs the loop (model → tools → model, max 5 steps) and returns `{ reply, events[] }`, where events are `booking_created` / `ticket_created` cards.
4. **Tools are plain TypeScript functions** over a `HotelRepository` interface. The Worker uses the D1 implementation; evals and the CLI use an in-memory one. One shared test suite (`repository.contract.ts`) runs against both. The clock is passed in too, so tests and evals can freeze "now".
5. **Dates.** The Worker computes today's date in `Asia/Riyadh` (UTC+3, no DST) and, from Phase 2, puts a 14-day calendar (date + Arabic/English weekday) in the system prompt. The model then *looks up* "الخميس الجاي" or "next Friday" instead of doing weekday arithmetic. Tools still validate: no past dates, check-out after check-in, 1 to 14 nights, at most 365 days ahead.
6. **Digits.** Arabic-Indic (٠–٩) and Persian (۰–۹) digits are normalized to 0–9 in every tool argument.
7. **Money** is stored as integer halalas (1 SAR = 100 halalas). Prices are VAT-inclusive (15%); tools return nights, total, and the VAT included.
8. **Availability** is night-based: a booking occupies nights `[check_in, check_out)`, and the rooms left for a stay are the rooms left on its busiest night. Holds and confirmed bookings count; cancelled ones don't. A hold is created by one SQL statement that checks and inserts together, so two guests can't both get the last room.
9. **Hotel facts reach the model only through `get_hotel_info(topic)`.** `worker/data/hotel-kb.ts` is the single source of truth; the `rooms` table is seeded from it. The system prompt lists the topic names, not the facts. Every factual answer therefore has a tool call behind it (which the evals can check), and an unknown topic tells the model to hand off.
10. **Rate limiting in two layers** (Phase 2): the Workers rate-limit binding for bursts (per IP), plus D1 daily counters (per IP and global) set below the Gemini free-tier daily quota, so the demo says "today's demo quota is used up" instead of failing halfway through a booking.
11. **Evals run in-process** with Node 24: the same agent core and real Gemini API, with the in-memory repository and a frozen clock.
12. **Frontend without extra libraries**: a tiny path switch instead of a router; a typed AR/EN dictionary instead of an i18n library; Tailwind logical utilities for RTL; per-message `dir`.
13. **Daily reset** at 00:00 UTC (03:00 Riyadh): wipe and reseed. The seed is dated relative to "today": for the coming weekend one Executive Suite is left and the Family Room is sold out.
14. **Rules that must hold are enforced in tool code, not only in the prompt:**
    - A party needing more than 3 rooms gets a `group_booking` failure that tells the model to hand off.
    - `create_booking_hold` requires `guest_confirmed: true`; otherwise it tells the model to read the details back first.
    - Tools work out how many rooms a party needs (`rooms_needed`) and price accordingly.
    - Phone numbers are validated and stored in international form.
15. **The guest's language is detected in code** (`detectLanguage`), not reported by the model, and stored on bookings and tickets.
16. **`handoff_to_staff` forgives bad arguments** (unknown reason → `other`, unknown urgency → `normal`, one summary copied to both languages). A handoff is the safety net and must not bounce over a formatting detail.
17. **"The weekend"** means Friday and Saturday (the Saudi weekend). A weekend stay is read as check-in Thursday, check-out Saturday, and the assistant always states the exact dates and gets a yes before holding a room.
19. **History replays tool calls in Gemini's own format.** Each assistant turn that used tools is sent back as model function calls, then tool results, then the reply. Replayed calls carry the placeholder thought signature Gemini's docs allow for injected calls. The system prompt also says a booking exists only if `create_booking_hold` returned a reference.
18. **Fictional data**: sample phone numbers use the obviously fake `+96650000000N` pattern; the knowledge base says outright that the hotel has no real address, phone or email.

---

## 4. D1 schema (`migrations/0001_init.sql`)

```sql
rooms (
  code TEXT PRIMARY KEY,            -- 'deluxe-sea', the id the model passes to tools
  name_en, name_ar, description_en, description_ar TEXT,
  capacity INTEGER,                 -- max guests per room, children included
  nightly_rate_halalas INTEGER,     -- VAT-inclusive
  total_units INTEGER
)
bookings (
  id INTEGER PRIMARY KEY,
  reference_code TEXT UNIQUE,       -- 'SDH-7K3Q', no 0/O/1/I/L
  session_id TEXT,                  -- links to the conversation log
  guest_name TEXT, phone TEXT,
  room_code TEXT REFERENCES rooms(code),
  check_in TEXT, check_out TEXT,    -- 'YYYY-MM-DD' (Riyadh dates)
  nights INTEGER, guests INTEGER,
  rooms INTEGER,                    -- 1 to 3 rooms of this type
  total_halalas INTEGER,            -- price snapshot at hold time
  notes TEXT,
  status TEXT CHECK (status IN ('hold','confirmed','cancelled')),
  language TEXT CHECK (language IN ('ar','en','mixed')),
  created_at TEXT
)  -- index on (room_code, check_in, check_out)
tickets (
  id INTEGER PRIMARY KEY, session_id TEXT,
  reason TEXT CHECK (reason IN ('human_request','complaint','out_of_scope','group_booking',
                                'special_pricing','medical_or_accessibility','other')),
  urgency TEXT CHECK (urgency IN ('low','normal','high')),
  summary_en TEXT, summary_ar TEXT,
  guest_name TEXT, phone TEXT, booking_reference TEXT,
  language TEXT, status TEXT CHECK (status IN ('open','resolved')),
  created_at TEXT, resolved_at TEXT
)
conversations (
  id INTEGER PRIMARY KEY, session_id TEXT,
  role TEXT CHECK (role IN ('user','assistant','tool')),
  content TEXT, language TEXT, created_at TEXT
)  -- written from Phase 2; purged daily
```

Phase 2 adds `usage_counters (day, key, count)` for the daily rate limits as migration `0002`.

---

## 5. File tree

Files marked `(P2)` to `(P6)` don't exist yet; the number is the phase that adds them.

```
.
├── README.md                     # short for now; full version in Phase 6
├── ARCHITECTURE.md               # (P6) request flow, interview-ready
├── docs/PLAN.md                  # this file
├── package.json
├── wrangler.jsonc                # Worker, assets, D1 (cron and rate limit come later)
├── vite.config.ts                # React + Tailwind + Cloudflare plugins
├── vitest.config.ts              # runs tests in the Workers runtime; loads the D1 migrations
├── tsconfig.json                 # + tsconfig.app.json / tsconfig.worker.json / tsconfig.node.json
├── worker-configuration.d.ts     # generated by `npm run cf-typegen` (git-ignored)
├── .dev.vars.example             # GEMINI_API_KEY=, GEMINI_MODEL=
├── index.html
├── public/favicon.svg
├── migrations/
│   └── 0001_init.sql
├── shared/                       # used by both Worker and browser
│   ├── types.ts                  # Room, Booking, Ticket, Language, handoff reasons
│   └── text.ts                   # digit normalization, language detection
├── worker/
│   ├── index.ts                  # Hono app: /api/health for now
│   ├── routes/                   # (P2) chat.ts  (P4) staff.ts  (P5) voice.ts
│   ├── ai/                       # (P2) agent.ts, gemini.ts, system-prompt.ts, tool-declarations.ts
│   ├── tools/
│   │   ├── index.ts              # tool names → handlers, runTool()
│   │   ├── tool-types.ts         # ToolContext, ToolResult, fail()
│   │   ├── args.ts               # ArgReader: checks the model's arguments
│   │   ├── shared-failures.ts    # failure messages used by several tools
│   │   ├── get-hotel-info.ts
│   │   ├── check-availability.ts
│   │   ├── create-booking-hold.ts
│   │   └── handoff-to-staff.ts
│   ├── domain/                   # pure logic, no I/O
│   │   ├── dates.ts              # Riyadh today, date maths, stay rules
│   │   ├── pricing.ts            # totals and VAT in halalas
│   │   ├── availability.ts       # busiest-night counting, rooms needed
│   │   ├── phone.ts              # phone validation and normalization
│   │   └── reference-code.ts
│   ├── data/
│   │   ├── hotel-kb.ts           # bilingual knowledge base (rooms + 14 topics)
│   │   ├── repository.ts         # HotelRepository interface
│   │   ├── d1-repository.ts      # D1 implementation (the SQL lives here)
│   │   ├── memory-repository.ts  # in-memory implementation (evals, CLI)
│   │   ├── repository.contract.ts# one test suite both implementations must pass
│   │   └── seed.ts               # demo data dated relative to today
│   ├── middleware/               # (P2) rate-limit.ts  (P4) staff-auth.ts
│   └── integrations/             # (P4) n8n.ts
├── src/                          # React app
│   ├── main.tsx, index.css
│   ├── App.tsx                   # placeholder status page until Phase 3
│   └── ...                       # (P3) pages/, components/, store/, i18n/, api/
├── scripts/
│   ├── local-db.ts               # opens the local D1 database from Node
│   ├── seed-local.ts             # npm run db:seed
│   ├── try-tool.ts               # npm run tool -- <tool> key=value ...
│   └── chat-cli.ts               # (P2) npm run chat
├── test/
│   ├── apply-migrations.ts       # creates the tables before each test file
│   └── env.d.ts
└── evals/                        # (P2) cases.json, run.ts, results.md
```

Unit tests sit next to the code they test (`*.test.ts`).

---

## 6. Dependencies (and why)

| Package | Where | Why | Added |
|---|---|---|---|
| `hono` | Worker | Routing and middleware (requested) | Phase 1 |
| `react`, `react-dom` | Browser | UI (requested) | Phase 1 |
| `vite`, `@vitejs/plugin-react` | Dev | Build and dev server | Phase 1 |
| `@cloudflare/vite-plugin`, `wrangler` | Dev | Runs the Worker inside Vite; deploy, D1, secrets, types | Phase 1 |
| `tailwindcss`, `@tailwindcss/vite` | Dev | Styling (requested) | Phase 1 |
| `typescript` | Dev | Type checking | Phase 1 |
| `vitest`, `@cloudflare/vitest-plugin` | Dev | Tests in the Workers runtime with a real local D1 | Phase 1 |
| `@types/node`, `@types/react`, `@types/react-dom` | Dev | Type definitions only | Phase 1 |
| `@google/genai` | Worker, evals | Official Gemini SDK (requested) | Phase 2 |
| `zustand` | Browser | State (requested) | Phase 3 |
| `jose` | Worker | Firebase ID-token verification (requested) | Phase 4 |
| `firebase` | Browser | Staff sign-in (requested) | Phase 4 |

Deliberately not added: a router, an i18n library, a validation library (four tools, so the hand-written `ArgReader` is short and readable), a linter (Cloudflare's template ships `oxlint`; easy to add if wanted), and `tsx` (Node 24 runs TypeScript directly).

---

## 7. Phases

**Phase 1: data + tools (done)**
Scaffold, `wrangler.jsonc` with the D1 binding, migration `0001_init.sql`, bilingual knowledge base, seed, repository (D1 + in-memory), the four tool functions, domain helpers, 155 tests.

**Phase 2: AI core**
Spike: `@google/genai` inside the Workers runtime. Then the system prompt (rules, topic list, 14-day calendar), tool declarations, agent loop, `POST /api/chat`, both rate-limit layers, conversation logging, `npm run chat` (CLI), `evals/cases.json` (~25 cases) and `npm run eval` (pass/fail table and `evals/results.md`, with `--model`, `--only` and a delay between calls).

**Phase 3: guest UI + first deploy**
Bilingual RTL chat page, AR/EN toggle, starter prompts, booking and ticket cards, typing indicator, error and rate-limit states, "Demo, fictional hotel" badge, "use made-up details" note, mobile-first layout. Deploy: D1 remote database, secrets, `wrangler deploy`, then Workers Builds connected to GitHub.

**Phase 4: staff side**
`/staff` with Bookings and Handoff tickets tabs (polling every 5 s), resolve button, reset button, daily reset cron. Guest phone numbers are masked for viewers who aren't signed in, since the dashboard is public in demo mode. Optional: Firebase Auth with `jose` verification for admin actions; n8n webhook on handoff (sent in the background with `ctx.waitUntil`) with the payload documented.

**Phase 5: voice (stretch)**
Push-to-talk with `MediaRecorder`, audio sent to `POST /api/voice`, Gemini takes the audio directly; optional `speechSynthesis` replies.

**Phase 6: polish**
README (screenshot/GIF, Mermaid diagram, setup, env vars, eval results, "what I'd build next"), `ARCHITECTURE.md`, and the 2-minute demo-video script.

---

## 8. Setup the repo owner does (credentials are never handled by the assistant)

- **Before Phase 2:** create a Gemini API key in Google AI Studio and paste it into `.dev.vars`. In AI Studio, note the project's rate limits for `gemini-3.5-flash-lite` and `gemini-3.8-flash` (RPM and RPD).
- **Before Phase 3:** run `npx wrangler login`. The Cloudflare account and the GitHub repo already exist.
- **Phase 4 (optional):** a Firebase project with Email/Password or Google sign-in enabled.

---

## 9. Risks

- **Free-tier quota.** If the daily request limit is small, a public link can run out of quota early in the day. Mitigation: daily caps and a friendly message. Each guest message costs about 2 to 3 model calls because of the tool loop.
- **SDK in the Workers runtime** isn't documented. Mitigation: the Phase 2 spike; fallback is to enable `nodejs_compat`, or to call the REST API with `fetch`.
- **Model quality vs. quota.** Flash-Lite may be weaker on dialect and tool use than 3.8 Flash. The evals measure both, which is a good README story either way.
- **Workers Free plan CPU limit.** Time spent waiting on Gemini doesn't count as CPU time, so this should be fine; we'll watch it after deploying.

---

## 10. Decisions on the open questions (answered 2026-11-11)

1. **Names.** Worker and package: `ai-receptionist`. GitHub repo: `ai-assistant`.
2. **Gemini endpoint.** `generateContent` behind the adapter. It is free on the free tier, like the Interactions API.
3. **Model and quota.** Free tier only. Default `GEMINI_MODEL=gemini-3.5-flash-lite`; the evals also run on `gemini-3.8-flash` for comparison if its quota allows.
4. **"The weekend".** Friday and Saturday; see decision 17.
