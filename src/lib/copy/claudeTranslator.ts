import { z } from "zod";
import {
  callClaude,
  type ClaudeCallOptions,
  type ClaudeResponse,
} from "../ai/claude";
import { buildTranslatorPrompt } from "./translatorPrompt";
import type {
  TranslateLLMFn,
  TranslateLLMResponse,
} from "./translateCampaignCopy";

// Adapter: bridge zwischen dem text-only callClaude und der TranslateLLMFn-Shape,
// die translateCampaignCopy erwartet. buildTranslatorPrompt baut den strikten
// Compliance-Prompt (Passthrough-Terms, keine Preise/Disclaimer).
//
// claudeFn ist injizierbar (Default = callClaude), damit Tests ohne echten
// API-Call laufen — analog zum llm-Parameter von generateCopy.

const CopyTripleSchema = z.object({
  headlines: z.array(z.string()),
  subline: z.string(),
  cta_label: z.string(),
});

const TranslateLLMResponseSchema = z.object({
  fr: CopyTripleSchema,
  it: CopyTripleSchema,
  en: CopyTripleSchema,
});

type ClaudeFn = (opts: ClaudeCallOptions) => Promise<ClaudeResponse<unknown>>;

export function createClaudeTranslator(
  claudeFn: ClaudeFn = callClaude
): TranslateLLMFn {
  return async (input) => {
    const { systemPrompt, userMessage } = buildTranslatorPrompt({
      sourceCopy: input.sourceCopy,
      passthroughTerms: input.passthroughTerms,
    });

    // Niedrige Temperatur: treue Uebersetzung, keine kreative Varianz.
    const res = await claudeFn({ systemPrompt, userMessage, temperature: 0.3 });

    // Fail-loud bei kaputter Struktur — translate-if-missing im Multiplexer
    // verlaesst sich darauf, dass eine erfolgreiche Antwort valide ist.
    const parsed = TranslateLLMResponseSchema.safeParse(res.data);
    if (!parsed.success) {
      throw new Error(
        `Translator-LLM lieferte ungueltige Struktur: ${parsed.error.message}`
      );
    }
    return parsed.data as TranslateLLMResponse;
  };
}
