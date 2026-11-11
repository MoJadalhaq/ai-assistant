// Wipes the local database and loads the demo data.
//
//   npm run db:seed
//
// Run `npm run db:migrate` once before it, to create the tables.

import { buildSeedData } from "../worker/data/seed.ts";
import { riyadhToday } from "../worker/domain/dates.ts";
import { withLocalRepository } from "./local-db.ts";

await withLocalRepository(async (repo) => {
  const now = new Date();
  const today = riyadhToday(now);

  await repo.replaceAllData(buildSeedData(today, now.toISOString()));

  const [rooms, bookings, tickets] = await Promise.all([repo.listRooms(), repo.listBookings(), repo.listTickets()]);
  console.log(
    `Local database seeded for ${today} (Riyadh): ${rooms.length} room types, ${bookings.length} bookings, ${tickets.length} tickets.`,
  );
});
