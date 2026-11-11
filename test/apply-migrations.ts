// Runs before every test file: creates the tables in the test database from the real
// migration files. Migrations that were already applied are skipped.

import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
