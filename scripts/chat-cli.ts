// Chat with the receptionist from the terminal. Uses the real Gemini API and an in-memory
// copy of the demo hotel (nothing is written to the database).
//
//   npm run chat                                   interactive; empty line to quit
//   npm run chat -- "first message" "second one"   sends each message in turn, then exits
//
// Reads GEMINI_API_KEY and GEMINI_MODEL from .dev.vars (Node's --env-file flag, see package.json).

import { createInterface } from "node:readline/promises";
import type { ChatTurn } from "../shared/api-types.ts";
import { conversationLanguage, runAgent } from "../worker/ai/agent.ts";
import { createGeminiClient, ModelBusyError } from "../worker/ai/gemini.ts";
import { MemoryRepository } from "../worker/data/memory-repository.ts";
import { buildSeedData } from "../worker/data/seed.ts";
import { riyadhToday } from "../worker/domain/dates.ts";

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
if (!apiKey) {
  console.error("GEMINI_API_KEY is missing. Copy .dev.vars.example to .dev.vars and add your key.");
  process.exit(1);
}

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const model = createGeminiClient(apiKey, modelName);
const repo = new MemoryRepository();
await repo.replaceAllData(buildSeedData(riyadhToday(new Date()), new Date().toISOString()));

const sessionId = `cli-${crypto.randomUUID()}`;
const history: ChatTurn[] = [];

async function send(message: string): Promise<void> {
  let result;
  try {
    result = await runAgent({
      model,
      history,
      message,
      ctx: { repo, now: new Date(), sessionId, language: conversationLanguage(history, message) },
    });
  } catch (error) {
    const reason =
      error instanceof ModelBusyError
        ? `Gemini is busy or the quota is used up. Try again in ${error.retryAfterSeconds} s.`
        : `The request failed: ${error instanceof Error ? error.message : String(error)}. Check your connection and try again.`;
    console.log(`${DIM}  ${reason}${RESET}\n`);
    return;
  }

  for (const { name, args, result: toolResult } of result.toolCalls) {
    const outcome = toolResult.ok ? "ok" : `failed: ${toolResult.error}`;
    console.log(`${DIM}  -> ${name} ${JSON.stringify(args)} (${outcome})${RESET}`);
  }
  console.log(`Receptionist: ${result.reply}\n`);

  history.push({ role: "user", text: message });
  history.push({ role: "assistant", text: result.reply, toolCalls: result.toolCalls });
}

console.log(`${DIM}Model: ${modelName}. Demo data dated ${riyadhToday(new Date())} (Riyadh).${RESET}\n`);

const scripted = process.argv.slice(2);
if (scripted.length > 0) {
  for (const message of scripted) {
    console.log(`Guest: ${message}`);
    await send(message);
  }
} else {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  for (;;) {
    const message = (await terminal.question("Guest: ")).trim();
    if (!message) break;
    await send(message);
  }
  terminal.close();
}
