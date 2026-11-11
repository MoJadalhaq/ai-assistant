import { Hono } from "hono";
import { HOTEL_NAME_EN } from "./data/hotel-kb.ts";
import { riyadhToday } from "./domain/dates.ts";

// `Env` is generated from wrangler.jsonc by `npm run cf-typegen`. It lists the bindings (here: DB).
const app = new Hono<{ Bindings: Env }>();

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

// Any other /api path gets a JSON 404, so an API client never receives the React page by mistake.
app.all("/api/*", (c) => c.json({ ok: false, error: "not_found" }, 404));

export default app;
