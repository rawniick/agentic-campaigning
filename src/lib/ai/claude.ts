import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 4096;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY ist nicht gesetzt");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface ClaudeCallOptions {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface ClaudeResponse<T> {
  data: T;
  rawText: string;
  tokensUsed: { input: number; output: number; total: number };
  model: string;
  stopReason: string | null;
}

export async function callClaude<T = unknown>(
  options: ClaudeCallOptions
): Promise<ClaudeResponse<T>> {
  const model = options.model ?? DEFAULT_MODEL;

  const response = await getClient().messages.create({
    model,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: options.temperature ?? 0.7,
    system: options.systemPrompt,
    messages: [{ role: "user", content: options.userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const rawText = textBlock && textBlock.type === "text" ? textBlock.text : "";

  let data: T;
  try {
    data = parseJsonResponse<T>(rawText);
  } catch {
    data = rawText as unknown as T;
  }

  return {
    data,
    rawText,
    tokensUsed: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      total: response.usage.input_tokens + response.usage.output_tokens,
    },
    model: response.model,
    stopReason: response.stop_reason,
  };
}

export function parseJsonResponse<T>(text: string): T {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    /* try markdown extraction */
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim()) as T;
    } catch {
      /* fall through */
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate) as T;
    } catch {
      /* fall through */
    }
  }

  throw new Error("JSON-Parsing fehlgeschlagen");
}

// Claude Sonnet 4.6 pricing (USD per 1M tokens): input 3, output 15
const USD_PER_M_INPUT = 3;
const USD_PER_M_OUTPUT = 15;
const USD_TO_CHF = 0.88;

export function estimateCostChf(inputTokens: number, outputTokens: number): number {
  const usd =
    (inputTokens / 1_000_000) * USD_PER_M_INPUT +
    (outputTokens / 1_000_000) * USD_PER_M_OUTPUT;
  return usd * USD_TO_CHF;
}
