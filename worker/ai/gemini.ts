// The only file that talks to Gemini. The tool loop (agent.ts) depends on the small
// ModelClient interface below, so tests can swap in a scripted fake, and the evals can
// point the same loop at another model.

import { ApiError, GoogleGenAI } from "@google/genai";
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

export function createGeminiClient(apiKey: string, model: string): ModelClient {
  const ai = new GoogleGenAI({ apiKey });

  async function callOnce({ systemInstruction, contents, tools }: ModelRequest): Promise<ModelTurn> {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: { systemInstruction, tools: [{ functionDeclarations: tools }] },
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
        if (!(error instanceof ApiError)) throw error;
        if (error.status === 429) throw new ModelBusyError(QUOTA_RETRY_SECONDS);
        if (error.status !== 503) throw error;
      }

      // Overloaded (503): wait briefly and try once more.
      await new Promise((resolve) => setTimeout(resolve, OVERLOAD_RETRY_DELAY_MS));
      try {
        return await callOnce(request);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 429 || error.status === 503)) {
          throw new ModelBusyError(error.status === 429 ? QUOTA_RETRY_SECONDS : OVERLOAD_RETRY_SECONDS);
        }
        throw error;
      }
    },
  };
}
