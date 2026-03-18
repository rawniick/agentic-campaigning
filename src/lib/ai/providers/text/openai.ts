// OpenAI Provider Adapter - GPT-4o / GPT-4o-mini als Fallback fuer Claude

import OpenAI from "openai";
import type {
  AIResponse,
  AIUsage,
  TextAIRequest,
  TextResponseData,
} from "../types";
import type { TextProvider } from "./types";

const DEFAULT_MODEL = "gpt-4o";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

let clientInstance: OpenAI | null = null;

function getClient(): OpenAI {
  if (!clientInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY ist nicht gesetzt");
    clientInstance = new OpenAI({ apiKey });
  }
  return clientInstance;
}

export const openaiProvider: TextProvider = {
  id: "openai",
  capability: "text",
  displayName: "OpenAI GPT",

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  },

  async execute(
    request: TextAIRequest
  ): Promise<AIResponse<TextResponseData>> {
    const client = getClient();
    const model =
      request.model && request.model !== "default"
        ? request.model
        : DEFAULT_MODEL;
    const temperature = request.temperature ?? 0.3;
    const maxTokens = request.maxTokens ?? 4096;

    let userMessage = request.userMessage;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const startMs = Date.now();

        const response = await client.chat.completions.create({
          model,
          max_tokens: maxTokens,
          temperature,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: userMessage },
          ],
          // JSON-Modus aktivieren wenn gewuenscht
          ...(request.responseFormat === "json"
            ? { response_format: { type: "json_object" } }
            : {}),
        });

        const choice = response.choices[0];
        if (!choice?.message?.content) {
          throw new Error("Keine Text-Antwort von OpenAI erhalten");
        }

        const rawText = choice.message.content.trim();
        const usage: AIUsage = {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        };

        return {
          success: true,
          data: {
            parsed: undefined as unknown,
            rawText,
            stopReason: choice.finish_reason,
          },
          provider: "openai",
          model: response.model,
          usage,
          costChf: 0, // Wird vom Router berechnet
          durationMs: Date.now() - startMs,
        };
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error(String(error));

        // Rate-Limit oder Server-Fehler: Retry mit Backoff
        const isRetryable =
          lastError.message.includes("rate_limit") ||
          lastError.message.includes("Rate limit") ||
          lastError.message.includes("429") ||
          lastError.message.includes("500") ||
          lastError.message.includes("503") ||
          lastError.message.includes("overloaded");

        if (isRetryable && attempt < MAX_RETRIES) {
          await new Promise((r) =>
            setTimeout(r, RETRY_DELAY_MS * Math.pow(2, attempt - 1))
          );
          continue;
        }

        // JSON-Parse-Fehler: Retry mit expliziterem Prompt
        if (lastError.message.includes("JSON") && attempt < MAX_RETRIES) {
          userMessage +=
            "\n\nWICHTIG: Antworte NUR mit validem JSON. Kein Markdown, keine Backticks.";
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }

        break;
      }
    }

    throw new Error(
      `OpenAI API Call fehlgeschlagen nach ${MAX_RETRIES} Versuchen: ${lastError?.message}`
    );
  },

  parseJsonResponse<T>(rawText: string): T {
    // Direkt als JSON
    try {
      return JSON.parse(rawText) as T;
    } catch {
      // weiter
    }

    // ```json ... ``` Block
    const jsonBlockMatch = rawText.match(
      /```(?:json)?\s*\n?([\s\S]*?)\n?```/
    );
    if (jsonBlockMatch?.[1]) {
      try {
        return JSON.parse(jsonBlockMatch[1].trim()) as T;
      } catch {
        // weiter
      }
    }

    // Erster { bis letzter }
    const firstBrace = rawText.indexOf("{");
    const lastBrace = rawText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(rawText.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        // weiter
      }
    }

    throw new Error(
      `JSON-Parsing fehlgeschlagen. Antwort: ${rawText.substring(0, 200)}...`
    );
  },
};
