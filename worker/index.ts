import { Hono } from "hono";
import { HOTEL_NAME_EN } from "./data/hotel-kb.ts";
import { resetDemo } from "./data/reset-demo.ts";
import { riyadhToday } from "./domain/dates.ts";
import { chat } from "./routes/chat.ts";
import { staff } from "./routes/staff.ts";

// `Env` is generated from wrangler.jsonc by `npm run cf-typegen`. It lists the bindings (here: DB).
export const app = new Hono<{ Bindings: Env }>();

// Health check. It reads from D1 on purpose: a green result proves the database binding and
// the migrations are in place, not only that the Worker started.
app.get("/api/health", async (c) => {
  const today = riyadhToday(new Date());
  try {
    const row = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM rooms").first<{ count: number }>();
    return c.json({ ok: true, hotel: HOTEL_NAME_EN, today, roomTypes: row?.count ?? 0 });
  } catch {
    return c.json(
      { ok: false, today, error: "database_not_ready", hint: "Run `npm run db:migrate` and then `npm run db:seed`." },
      503,
    );
  }
});

app.route("/api/chat", chat);
app.route("/api/staff", staff);

// Any other /api path gets a JSON 404, so an API client never receives the React page by mistake.
app.all("/api/*", (c) => c.json({ ok: false, error: "not_found" }, 404));

// An unexpected error still answers in the same JSON shape the browser already understands.
app.onError((error, c) => {
  console.error(`${c.req.method} ${c.req.path} failed:`, error);
  return c.json({ ok: false, error: "internal_error" }, 500);
});

export default {
  fetch: app.fetch,

  // The Cron Trigger in wrangler.jsonc (00:00 UTC, 03:00 in Riyadh) restores the demo hotel every night.
  async scheduled(controller, env) {
    const { today } = await resetDemo(env.DB, new Date(controller.scheduledTime));
    console.log(`Demo data reset for ${today}`);
  },
} satisfies ExportedHandler<Env>;
