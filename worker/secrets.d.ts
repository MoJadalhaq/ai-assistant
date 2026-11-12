// Secrets are not in wrangler.jsonc, so `wrangler types` only sees them when a local .dev.vars
// exists. Declaring them here keeps type checking working on build machines that have no .dev.vars.

interface Env {
  GEMINI_API_KEY: string;
  /** Optional: where to send handoff notifications (worker/integrations/n8n.ts). Empty or unset turns them off. */
  N8N_WEBHOOK_URL: string;
}
