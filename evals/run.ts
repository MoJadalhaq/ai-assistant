// Runs the eval cases against the real Gemini API and writes evals/results.md.
//
//   npm run eval                                     every case, model from .dev.vars
//   npm run eval -- --only=handoff-manager-en,faq-wifi-formal
//   npm run eval -- --model=gemini-3.8-flash --thinking=low
//   npm run eval -- --delay=6000                     ms between model calls (free-tier per-minute limit)
//   npm run eval -- --out=evals/results-3.8.md
//
// Each case gets a fresh in-memory copy of the demo hotel and the clock frozen at cases.json "now",
// so relative dates ("بكرة", "next Friday") have exactly one right answer.

import { readFileSync, writeFileSync } from "node:fs";
import type { ChatTurn } from "../shared/api-types.ts";
import { conversationLanguage, runAgent } from "../worker/ai/agent.ts";
import { createGeminiClient, ModelBusyError, parseThinkingLevel } from "../worker/ai/gemini.ts";
import type { ModelClient } from "../worker/ai/gemini.ts";
import { MemoryRepository } from "../worker/data/memory-repository.ts";
import { buildSeedData } from "../worker/data/seed.ts";
import { riyadhToday } from "../worker/domain/dates.ts";
import { gradeCase } from "./checks.ts";
import type { CheckResult, EvalCase, TranscriptTurn } from "./checks.ts";

const MAX_ATTEMPTS = 3;
const NETWORK_RETRY_MS = 10_000;

interface CaseFile {
  now: string;
  cases: EvalCase[];
}

interface CaseOutcome {
  evalCase: EvalCase;
  status: "pass" | "fail" | "error";
  checks: CheckResult[];
  transcript: TranscriptTurn[];
  error?: string;
}

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

const flags = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=")];
  }),
);

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is missing. Copy .dev.vars.example to .dev.vars and add your key.");
  process.exit(1);
}

const modelName = flags.model || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const thinking = flags.thinking || process.env.GEMINI_THINKING_LEVEL || "";
const delayMs = Number(flags.delay || 4500);
const outPath = flags.out || "evals/results.md";

// npm scripts run from the project root, so this relative path is stable.
const file = JSON.parse(readFileSync("evals/cases.json", "utf8")) as CaseFile;
const only = flags.only ? new Set(flags.only.split(",")) : null;
const cases = file.cases.filter((evalCase) => !only || only.has(evalCase.id));
const now = new Date(file.now);

// ---------------------------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------------------------

/** Spaces out model calls so a full run stays under the free tier's requests-per-minute limit. */
function throttled(model: ModelClient, minGapMs: number): ModelClient & { calls: number } {
  let lastCall = 0;
  const wrapper = {
    calls: 0,
    async generate(request: Parameters<ModelClient["generate"]>[0]) {
      const wait = lastCall + minGapMs - Date.now();
      if (wait > 0) await sleep(wait);
      lastCall = Date.now();
      wrapper.calls++;
      return model.generate(request);
    },
  };
  return wrapper;
}

const model = throttled(createGeminiClient(apiKey, modelName, thinking), delayMs);

async function runConversation(evalCase: EvalCase): Promise<TranscriptTurn[]> {
  const repo = new MemoryRepository();
  await repo.replaceAllData(buildSeedData(riyadhToday(now), now.toISOString()));

  const history: ChatTurn[] = [];
  const transcript: TranscriptTurn[] = [];

  for (const message of evalCase.turns) {
    const result = await runAgent({
      model,
      history,
      message,
      ctx: { repo, now, sessionId: `eval-${evalCase.id}`, language: conversationLanguage(history, message) },
    });
    transcript.push({ guest: message, reply: result.reply, toolCalls: result.toolCalls });
    history.push({ role: "user", text: message });
    history.push({ role: "assistant", text: result.reply, toolCalls: result.toolCalls });
  }
  return transcript;
}

/** Overload, quota and network errors are retried: they say nothing about the assistant's quality. */
async function runCase(evalCase: EvalCase): Promise<CaseOutcome> {
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const transcript = await runConversation(evalCase);
      const checks = gradeCase(evalCase, transcript);
      const status = checks.every((check) => check.passed) ? "pass" : "fail";
      return { evalCase, status, checks, transcript };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      const waitMs = error instanceof ModelBusyError ? error.retryAfterSeconds * 1000 : NETWORK_RETRY_MS;
      if (attempt < MAX_ATTEMPTS) {
        console.log(`   ${evalCase.id}: ${lastError.slice(0, 80)}. Retrying in ${Math.round(waitMs / 1000)} s.`);
        await sleep(waitMs);
      }
    }
  }
  return { evalCase, status: "error", checks: [], transcript: [], error: lastError };
}

// ---------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------

const started = Date.now();
const level = parseThinkingLevel(thinking) ?? "model default";
console.log(`Running ${cases.length} cases on ${modelName} (thinking: ${level}), ${delayMs} ms between calls.\n`);

const outcomes: CaseOutcome[] = [];
for (const [index, evalCase] of cases.entries()) {
  const outcome = await runCase(evalCase);
  outcomes.push(outcome);
  const failed = outcome.checks.filter((check) => !check.passed).map((check) => check.check);
  const mark = { pass: "PASS ", fail: "FAIL ", error: "ERROR" }[outcome.status];
  console.log(`${String(index + 1).padStart(2)}. ${mark} ${evalCase.id}${failed.length ? `  (${failed.join("; ")})` : ""}`);
}

const passed = outcomes.filter((outcome) => outcome.status === "pass").length;
const minutes = ((Date.now() - started) / 60_000).toFixed(1);
console.log(`\n${passed}/${outcomes.length} passed. ${model.calls} model calls in ${minutes} min.`);

writeFileSync(outPath, buildReport(outcomes, passed, minutes));
console.log(`Report written to ${outPath}`);

function buildReport(results: CaseOutcome[], passCount: number, duration: string): string {
  const categories = [...new Set(results.map((result) => result.evalCase.category))];
  const byCategory = categories
    .map((category) => {
      const inCategory = results.filter((result) => result.evalCase.category === category);
      const ok = inCategory.filter((result) => result.status === "pass").length;
      return `| ${category} | ${ok}/${inCategory.length} |`;
    })
    .join("\n");

  const rows = results
    .map((result, index) => {
      const failed = result.checks.filter((check) => !check.passed);
      const why = result.status === "error" ? result.error : failed.map((check) => `${check.check}: ${check.detail}`).join("<br>");
      return `| ${index + 1} | \`${result.evalCase.id}\` | ${result.evalCase.language} | ${result.status.toUpperCase()} | ${escapeCell(why ?? "")} |`;
    })
    .join("\n");

  const failures = results
    .filter((result) => result.status === "fail")
    .map((result) => {
      const turns = result.transcript
        .map((turn) => {
          const tools = turn.toolCalls.map((call) => `  - \`${call.name}\` ${JSON.stringify(call.args)} → ${call.result.ok ? "ok" : String(call.result.error)}`).join("\n");
          return `- **Guest:** ${turn.guest}\n${tools ? `${tools}\n` : ""}- **Assistant:** ${turn.reply.replace(/\s+/g, " ").slice(0, 400)}`;
        })
        .join("\n");
      return `### \`${result.evalCase.id}\`\n${result.evalCase.note ? `_${result.evalCase.note}_\n\n` : ""}${turns}`;
    })
    .join("\n\n");

  return `# Eval results

- **Model:** \`${modelName}\` (thinking: ${level})
- **Run:** ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC, ${duration} min, ${model.calls} model calls
- **Clock frozen at:** ${file.now} (Wednesday, 12:00 Riyadh)
- **Result: ${passCount}/${results.length} cases passed**

Every check is deterministic: expected tool calls and arguments, forbidden tools, reply language,
key facts, leaked text, and (for every case) no invented booking reference. Cases are in
[cases.json](cases.json); run them with \`npm run eval\`.

| Category | Passed |
|---|---|
${byCategory}

| # | Case | Language | Result | Failed checks |
|---|---|---|---|---|
${rows}

## Failed conversations

${failures || "None."}
`;
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
