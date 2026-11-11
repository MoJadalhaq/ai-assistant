// Adds the test-only binding from vitest.config.ts to the Worker's Env type.

declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
