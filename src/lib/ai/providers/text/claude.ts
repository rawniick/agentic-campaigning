// Claude Provider Adapter - extrahiert aus src/lib/ai/claude.ts

import Anthropic from "@anthropic-ai/sdk";
import type {
  AIResponse,
  AIUsage,
  TextAIRequest,
  TextResponseData,
} from "../types";
import type { TextProvider } from "./types";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

let clientInstance: Anthropic | null = null;

function getClient(): Anthropic {
  if (!clientInstance) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY ist nicht gesetzt");
    clientInstance = new Anthropic({ apiKey });
  }
  return clientInstance;
}

export const claudeProvider: TextProvider = {
  id: "claude",
  capability: "text",
  displayName: "Anthropic Claude",

  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
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
        const response = await client.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          system: request.systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        });

        const textBlock = response.content.find((b) => b.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          throw new Error("Keine Text-Antwort von Claude erhalten");
        }

        const rawText = textBlock.text.trim();
        const usage: AIUsage = {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens:
            response.usage.input_tokens + response.usage.output_tokens,
        };

        return {
          success: true,
          data: {
            parsed: undefined as unknown,
            rawText,
            stopReason: response.stop_reason,
          },
          provider: "claude",
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
          lastError.message.includes("overloaded") ||
          lastError.message.includes("529") ||
          lastError.message.includes("500");

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
      `Claude API Call fehlgeschlagen nach ${MAX_RETRIES} Versuchen: ${lastError?.message}`
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

/** Exportiert fuer Abwaertskompatibilitaet (claude.ts Facade) */
export function parseJsonResponse<T>(text: string): T {
  return claudeProvider.parseJsonResponse<T>(text);
}
