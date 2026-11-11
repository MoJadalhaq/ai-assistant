import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The cloudflare() plugin runs worker/index.ts inside the real Workers runtime during `vite dev`,
// with the bindings from wrangler.jsonc (the local D1 database). There is no separate API server.
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
});
