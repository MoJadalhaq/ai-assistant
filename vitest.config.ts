import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Tests run inside the Workers runtime (the same engine as production), not in Node.
// Each run gets its own empty local D1 database.
export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      // The real migration files are read here, in Node, and handed to the test runtime as a
      // binding. test/apply-migrations.ts then runs them, so tests use the production schema.
      const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));
      return {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
      };
    }),
  ],
  test: {
    setupFiles: ["./test/apply-migrations.ts"],
  },
});
