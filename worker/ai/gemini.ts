// The only file that talks to Gemini. The tool loop (agent.ts) depends on the small
// ModelClient interface below, so tests can swap in a scripted fake, and the evals can
// point the same loop at another model.

import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { Content, FunctionCall, FunctionDeclaration } from "@google/genai";

export interface ModelRequest {
  systemInstruction: string;
  contents: Content[];
  tools: FunctionDeclaration[];
}

export interface ModelTurn {
  /** The model's full reply, kept as received: it carries the thought signatures Gemini 3 checks. */
  content: Content;
  functionCalls: FunctionCall[];
  /** The reply text for the guest (thinking parts excluded). Empty when the model only called tools. */
  text: string;
}

export interface ModelClient {
  generate(request: ModelRequest): Promise<ModelTurn>;
}

/**
 * Gemini can't take the request right now: either our free-tier quota is used up (429),
 * or the model is overloaded (503 "high demand", common on the free tier).
 */
export class ModelBusyError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("The model's request quota is used up for now");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const QUOTA_RETRY_SECONDS = 60;
const OVERLOAD_RETRY_SECONDS = 20;
/** One quick retry for an overloaded model: those spikes often pass within a second or two. */
const OVERLOAD_RETRY_DELAY_MS = 1500;

/** "low", "LOW" etc. become the SDK's enum value; anything else means "use the model's default". */
export function parseThinkingLevel(value: string | undefined): ThinkingLevel | undefined {
  const upper = value?.trim().toUpperCase();
  return Object.values(ThinkingLevel).find((level) => level === upper && level !== ThinkingLevel.THINKING_LEVEL_UNSPECIFIED);
}

export function createGeminiClient(apiKey: string, model: string, thinkingLevel?: string): ModelClient {
  const ai = new GoogleGenAI({ apiKey });
  const level = parseThinkingLevel(thinkingLevel);

  async function callOnce({ systemInstruction, contents, tools }: ModelRequest): Promise<ModelTurn> {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: tools }],
        // More thinking: better instruction-following, but slower. The evals compare levels.
        ...(level && { thinkingConfig: { thinkingLevel: level } }),
      },
    });

    const content: Content = response.candidates?.[0]?.content ?? { role: "model", parts: [] };
    const text = (content.parts ?? [])
      .filter((part) => part.text && !part.thought)
      .map((part) => part.text)
      .join("")
      .trim();

    return { content, functionCalls: response.functionCalls ?? [], text };
  }

  return {
    async generate(request) {
      try {
        return await callOnce(request);
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) throw new ModelBusyError(QUOTA_RETRY_SECONDS);
        if (!isTemporary(error)) throw error;
      }

      // Overloaded, or the connection dropped: wait briefly and try once more.
      await new Promise((resolve) => setTimeout(resolve, OVERLOAD_RETRY_DELAY_MS));
      try {
        return await callOnce(request);
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) throw new ModelBusyError(QUOTA_RETRY_SECONDS);
        if (isTemporary(error)) throw new ModelBusyError(OVERLOAD_RETRY_SECONDS);
        throw error;
      }
    },
  };
}

/**
 * Worth one retry: Gemini overloaded (503), or the request never got an HTTP answer at all
 * (connection reset, DNS, timeout). Any other API error, such as a 400 for a bad request,
 * would fail the same way again.
 */
function isTemporary(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 503;
  return error instanceof Error;
}
