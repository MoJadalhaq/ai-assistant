# Sahil Demo Hotel: AI Receptionist (project plan)

> Demo project. **Sahil Demo Hotel, Jeddah is fictional.** All names, prices, phone numbers and bookings in this repo are made up.

Status: **Phase 0 (plan)**, written 2026-11-11. This file is the reference for decisions; it will be updated when a decision changes.

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
- The **Interactions API is GA (June 2026) and "recommended for all new projects"**; `generateContent` is labelled **"legacy" but "fully supported"**. See open question 2.
- Gemini 3.x function calling uses **thought signatures**: within the current turn, the model's function-call parts must be sent back exactly as received (the SDK handles this when the full model content is appended to history). Earlier turns can be plain text.
- Gemini 3.6+ ignore `temperature` / `top_p` / `top_k`, so we won't set them.
- Thinking defaults: 3.8 Flash = medium (low/medium/high); 3.5 Flash-Lite = minimal. Lower thinking means lower latency; the evals will pick the level.
- Audio input supports `audio/webm` and `audio/m4a`/`audio/aac` inline (20 MB request cap), which covers `MediaRecorder` in Chrome and Safari (Phase 5).
- `@google/genai` 3.1.0 requires Node 22+. Running it inside the Workers runtime isn't documented either way, so Phase 2 starts with a short spike to confirm it.

**Firebase** (Phase 4): verify the ID token's RS256 signature against Google's securetoken public keys, `aud` = project ID, `iss` = `https://securetoken.google.com/<projectId>`, plus `exp`, `iat`, `auth_time`, `sub`.

---

## 3. Key design decisions

1. **One Worker** (Hono) serves the SPA and `/api/*`, plus a `scheduled()` handler for the daily reset.
2. **Model access behind a thin adapter** (`worker/ai/gemini.ts`), so the tool loop doesn't depend on which Gemini endpoint we call. Default: `generateContent` (open question 2).
3. **Stateless chat.** The browser keeps the conversation and sends the last ~12 turns with each request: user/assistant text, plus a compact note of earlier tool results (e.g. "availability: deluxe-sea, 2 nights, SAR 1,380") so the model remembers what it offered without replaying opaque model parts. The Worker runs the loop (model → tools → model, max 5 steps) and returns `{ reply, events[] }`, where events are `booking_created` / `ticket_created` cards.
4. **Tools are plain TypeScript functions** over a `HotelRepository` interface. The Worker uses the D1 implementation; evals and the CLI use an in-memory one seeded with the same data. The clock is injected too, so tests and evals can freeze "now".
5. **Dates.** The Worker computes today's date in `Asia/Riyadh` (UTC+3, no DST) and puts a 14-day calendar (date + Arabic/English weekday) in the system prompt. The model then *looks up* "الخميس الجاي" or "next Friday" instead of doing weekday arithmetic, which models often get wrong. Tools still validate: no past dates, check-out after check-in, 1 to 14 nights.
6. **Digits.** Arabic-Indic (٠–٩) and Persian (۰–۹) digits are normalized to 0–9 on incoming messages and on every tool argument.
7. **Money** is stored as integer halalas (1 SAR = 100 halalas) to avoid floating-point errors. Knowledge-base prices are VAT-inclusive (15%); tools return nights, total, and the VAT included.
8. **Availability** is night-based: a booking occupies nights `[check_in, check_out)`. Holds and confirmed bookings count; cancelled ones don't. Booking holds use a guarded insert so two guests can't both hold the last room.
9. **The knowledge base (`worker/data/hotel-kb.ts`) is the single source of truth.** The `rooms` table is seeded from it, so prices can't drift between the prompt and the database.
10. **Rate limiting in two layers**: the Workers rate-limit binding for bursts (per IP, e.g. 5 requests per 60 s), plus D1 daily counters (per IP and global). The global cap is set below the Gemini free-tier daily quota, so the demo says "today's demo quota is used up" instead of failing halfway through a booking. Gemini 429s are also returned as a friendly error with a `retryAfter`.
11. **Evals run in-process** with Node 24 (which runs TypeScript directly, no `tsx` needed): the same agent core and real Gemini API, with the in-memory repository and a frozen clock. That makes relative-date cases deterministic and needs no server running.
12. **Frontend without extra libraries**: two pages, so a tiny path switch instead of a router; a typed AR/EN dictionary instead of an i18n library; Tailwind logical utilities (`ms-*`, `pe-*`, `start-*`) for RTL; per-message `dir` from the first strong character (Arabic or Latin).
13. **Daily reset** at 00:00 UTC (03:00 Riyadh): wipe and reseed, including a few bookings dated relative to "today", so availability is realistic (some rooms nearly full this weekend) and the dashboard isn't empty.
14. **Fictional data**: the knowledge base has no real-looking phone numbers; emails use the reserved `example` domain.

---

## 4. D1 schema (revised from the brief)

```sql
rooms (
  code TEXT PRIMARY KEY,            -- 'deluxe-sea', stable id the model passes to tools
  name_en TEXT, name_ar TEXT,
  capacity INTEGER,                 -- max guests per room
  nightly_rate_halalas INTEGER,     -- VAT-inclusive
  total_units INTEGER
)
bookings (
  id INTEGER PRIMARY KEY,
  reference_code TEXT UNIQUE,       -- 'SDH-7K3Q', unambiguous alphabet
  session_id TEXT,                  -- links to the conversation log
  guest_name TEXT, phone TEXT,
  room_code TEXT REFERENCES rooms(code),
  check_in TEXT, check_out TEXT,    -- 'YYYY-MM-DD' (Riyadh dates)
  nights INTEGER, guests INTEGER,
  total_halalas INTEGER,            -- price snapshot at hold time
  notes TEXT,
  status TEXT CHECK (status IN ('hold','confirmed','cancelled')),
  language TEXT CHECK (language IN ('ar','en','mixed')),
  created_at TEXT
)  -- index on (room_code, check_in, check_out)
tickets (
  id INTEGER PRIMARY KEY, session_id TEXT,
  reason TEXT, urgency TEXT CHECK (urgency IN ('low','normal','high')),
  summary_en TEXT, summary_ar TEXT,
  guest_name TEXT, phone TEXT, guest_details_json TEXT,
  language TEXT, status TEXT CHECK (status IN ('open','resolved')),
  created_at TEXT, resolved_at TEXT
)
conversations (
  id INTEGER PRIMARY KEY, session_id TEXT,
  role TEXT CHECK (role IN ('user','assistant','tool')),
  content TEXT, language TEXT, created_at TEXT
)  -- index on session_id; purged daily
usage_counters (day TEXT, key TEXT, count INTEGER, PRIMARY KEY (day, key))
  -- daily per-IP and global message counts for the free-tier budget
```

Changes from the brief: price snapshot and nights on bookings, `session_id` everywhere (so staff can open the transcript behind a ticket), `CHECK` constraints for enums, money in halalas, and a `usage_counters` table.

---

## 5. File tree (target, after Phase 6)

```
.
├── README.md                     # Phase 6: screenshot/GIF, Mermaid diagram, setup, eval summary
├── ARCHITECTURE.md               # Phase 6: request flow, interview-ready
├── docs/PLAN.md                  # this file
├── package.json
├── wrangler.jsonc                # Worker, assets, D1, cron, rate limit, vars
├── vite.config.ts                # React + Tailwind + Cloudflare plugins
├── vitest.config.ts              # cloudflareTest(); applies D1 migrations
├── tsconfig.json                 # + tsconfig.app.json / tsconfig.worker.json / tsconfig.node.json
├── worker-configuration.d.ts     # generated by `wrangler types` (Env type)
├── .dev.vars.example             # GEMINI_API_KEY=, GEMINI_MODEL=, N8N_WEBHOOK_URL=, ...
├── .gitignore
├── index.html
├── migrations/
│   └── 0001_init.sql
├── shared/                       # used by both Worker and browser
│   ├── api-types.ts              # ChatRequest, ChatResponse, ChatEvent, Booking, Ticket
│   └── text.ts                   # digit normalization, Arabic/Latin detection, dir
├── worker/
│   ├── index.ts                  # Hono app + scheduled() export
│   ├── routes/
│   │   ├── chat.ts               # POST /api/chat
│   │   ├── staff.ts              # GET bookings/tickets, POST resolve, POST reset
│   │   └── voice.ts              # Phase 5: POST /api/voice
│   ├── ai/
│   │   ├── agent.ts              # the tool-call loop (provider-agnostic)
│   │   ├── gemini.ts             # @google/genai adapter
│   │   ├── system-prompt.ts      # rules + KB + Riyadh date context
│   │   └── tool-declarations.ts  # JSON schemas the model sees
│   ├── tools/
│   │   ├── index.ts              # name → handler, argument validation
│   │   ├── get-hotel-info.ts
│   │   ├── check-availability.ts
│   │   ├── create-booking-hold.ts
│   │   └── handoff-to-staff.ts
│   ├── domain/                   # pure logic, no I/O
│   │   ├── dates.ts              # Riyadh today, nights, 14-day calendar
│   │   ├── pricing.ts            # totals and VAT in halalas
│   │   ├── availability.ts       # night-overlap counting
│   │   └── reference-code.ts
│   ├── data/
│   │   ├── hotel-kb.ts           # bilingual knowledge base
│   │   ├── repository.ts         # HotelRepository interface
│   │   ├── d1-repository.ts      # D1 implementation
│   │   ├── memory-repository.ts  # in-memory implementation (evals, CLI)
│   │   └── seed.ts               # reset + seed (cron, reset endpoint, tests)
│   ├── middleware/
│   │   ├── rate-limit.ts
│   │   └── staff-auth.ts         # Phase 4: Firebase ID token check with jose
│   └── integrations/
│       └── n8n.ts                # Phase 4: handoff webhook
├── src/                          # React app
│   ├── main.tsx
│   ├── App.tsx                   # "/" guest chat, "/staff" dashboard
│   ├── index.css                 # Tailwind + Arabic font
│   ├── i18n/strings.ts           # AR/EN UI strings
│   ├── store/
│   │   ├── chat-store.ts         # Zustand: messages, pending, errors
│   │   └── ui-store.ts           # UI language and direction
│   ├── api/client.ts             # fetch wrappers, friendly 429 handling
│   ├── components/               # ChatBubble, Composer, StarterPrompts, BookingCard,
│   │                             # TicketCard, TypingIndicator, LangToggle, DemoBadge
│   └── pages/
│       ├── GuestChat.tsx
│       └── StaffDashboard.tsx
├── scripts/
│   └── chat-cli.ts               # npm run chat: terminal chat against the agent
└── evals/
    ├── cases.json                # ~25 cases
    ├── run.ts                    # npm run eval
    └── results.md                # generated
```

Unit tests sit next to the code they test (`*.test.ts`).

---

## 6. Dependencies (and why)

| Package | Where | Why |
|---|---|---|
| `hono` | Worker | Routing and middleware (requested) |
| `@google/genai` | Worker, evals | Official Gemini SDK (requested) |
| `react`, `react-dom` | Browser | UI (requested) |
| `zustand` | Browser | State (requested) |
| `vite`, `@vitejs/plugin-react` | Dev | Build and dev server |
| `@cloudflare/vite-plugin`, `wrangler` | Dev | Runs the Worker inside Vite; deploy, D1, secrets |
| `tailwindcss`, `@tailwindcss/vite` | Dev | Styling (requested) |
| `typescript` | Dev | Type checking |
| `vitest`, `@cloudflare/vitest-plugin` | Dev | Unit tests in the Workers runtime with a real local D1 |
| `jose` | Worker, Phase 4 | Firebase ID-token verification (requested) |
| `firebase` | Browser, Phase 4 | Staff sign-in (requested) |

Deliberately not added: a router, an i18n library, a validation library (four tools, so hand-written validators are short and readable), and `tsx` (Node 24 runs TypeScript directly).

---

## 7. Phases

**Phase 1: data + tools**
Scaffold (hand-written, mirroring the Cloudflare React template without its demo boilerplate), `wrangler.jsonc` with the D1 binding, migration `0001_init.sql`, bilingual knowledge base, seed, repository (D1 + in-memory), the four tool functions, domain helpers. Vitest: night-overlap availability, price/VAT totals, Riyadh dates and the calendar, digit normalization, tool argument validation, and repository tests against local D1.

**Phase 2: AI core**
Spike: `@google/genai` inside the Workers runtime. Then the system prompt, tool declarations, agent loop, `POST /api/chat`, both rate-limit layers, conversation logging, `npm run chat` (CLI), `evals/cases.json` (~25 cases) and `npm run eval` (pass/fail table and `evals/results.md`, with `--model`, `--only` and a delay between calls).

**Phase 3: guest UI + first deploy**
Bilingual RTL chat page, AR/EN toggle, starter prompts, booking and ticket cards, typing indicator, error and rate-limit states, "Demo, fictional hotel" badge, "use made-up details" note, mobile-first layout. Deploy: D1 remote database, secrets, `wrangler deploy`, then Workers Builds connected to GitHub.

**Phase 4: staff side**
`/staff` with Bookings and Handoff tickets tabs (polling every 5 s), resolve button, reset button, daily reset cron. Optional: Firebase Auth with `jose` verification for admin actions; n8n webhook on handoff (sent in the background with `ctx.waitUntil`) with the payload documented.

**Phase 5: voice (stretch)**
Push-to-talk with `MediaRecorder`, audio sent to `POST /api/voice`, Gemini takes the audio directly; optional `speechSynthesis` replies.

**Phase 6: polish**
README (screenshot/GIF, Mermaid diagram, setup, env vars, eval results, "what I'd build next"), `ARCHITECTURE.md`, and the 2-minute demo-video script.

---

## 8. Setup you'll need to do (I won't handle your credentials)

- **Before Phase 2:** create a Gemini API key in Google AI Studio and paste it into `.dev.vars` yourself (copy `.dev.vars.example`). In AI Studio, check your project's rate limits for `gemini-3.5-flash-lite` and `gemini-3.8-flash` (RPM and RPD).
- **Before Phase 3:** a Cloudflare account; run `npx wrangler login` yourself; an empty public GitHub repo.
- **Phase 4 (optional):** a Firebase project with Email/Password or Google sign-in enabled.

---

## 9. Risks

- **Free-tier quota.** If the daily request limit is small, a public link can run out of quota early in the day. Mitigation: daily caps and a friendly message; optionally paid tier with a budget cap. Each guest message costs about 2 to 3 model calls because of the tool loop.
- **SDK in the Workers runtime** isn't documented. Mitigation: the Phase 2 spike; fallback is to enable `nodejs_compat`.
- **Model quality vs. quota.** Flash-Lite may be weaker on dialect and tool use than 3.8 Flash. The evals measure both, which is a good README story either way.
- **Workers Free plan CPU limit.** Time spent waiting on Gemini doesn't count as CPU time, so this should be fine; we'll watch it after deploying.

---

## 10. Open questions

1. **Repo and Worker name.** Proposed name: `sahil-ai-receptionist` (GitHub repo, Worker name, `package.json`).
2. **Gemini endpoint.** Recommended: `generateContent` (legacy but fully supported) behind the adapter. It fits the stateless design: earlier turns can be plain text, and only the current turn's tool calls carry thought signatures. The Interactions API is Google's recommended new interface, but stateless use means replaying every thought block exactly as received, or keeping server-side state with Google.
3. **Model and quota.** Proposed default: `GEMINI_MODEL=gemini-3.5-flash-lite`, with the evals also run on `gemini-3.8-flash` for comparison. Is staying on the free tier for the public link a hard rule? If you'd enable billing with a spending cap, I'd default to 3.8 Flash.
4. **"The weekend".** In Saudi Arabia the weekend is Friday and Saturday. Proposed: "الويكند" / "this weekend" means check-in Thursday and check-out Saturday (Thursday and Friday nights), and the assistant always reads the dates back before holding.
