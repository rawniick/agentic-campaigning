// Multi-Provider Kostenberechnung

import type { AIProviderId, AIUsage } from "./types";

// Pricing in USD pro Einheit (wird spaeter aus DB geladen)
const PROVIDER_PRICING: Record<
  string,
  {
    inputTokenPer1M?: number;
    outputTokenPer1M?: number;
    perImage?: number;
    perVideoSecond?: number;
    perAudioSecond?: number;
  }
> = {
  claude: { inputTokenPer1M: 3.0, outputTokenPer1M: 15.0 },
  openai: { inputTokenPer1M: 2.5, outputTokenPer1M: 10.0 },
  gemini: { inputTokenPer1M: 1.25, outputTokenPer1M: 5.0 },
  nanobanana: { perImage: 0.02 },
  dalle: { perImage: 0.04 },
  flux: { perImage: 0.03 },
  stable_diffusion: { perImage: 0.02 },
  veo3: { perVideoSecond: 0.06 },
  runway: { perVideoSecond: 0.05 },
  sora: { perVideoSecond: 0.10 },
  kling: { perVideoSecond: 0.04 },
  elevenlabs: { perAudioSecond: 0.001 },
  canva: {},
};

const USD_TO_CHF = 0.88;

/** Kosten in CHF berechnen basierend auf Provider und Usage */
export function calculateCostChf(
  providerId: AIProviderId,
  usage: AIUsage
): number {
  const pricing = PROVIDER_PRICING[providerId];
  if (!pricing) return 0;

  let costUsd = 0;

  if (usage.inputTokens && pricing.inputTokenPer1M) {
    costUsd += (usage.inputTokens / 1_000_000) * pricing.inputTokenPer1M;
  }
  if (usage.outputTokens && pricing.outputTokenPer1M) {
    costUsd += (usage.outputTokens / 1_000_000) * pricing.outputTokenPer1M;
  }
  if (usage.imagesGenerated && pricing.perImage) {
    costUsd += usage.imagesGenerated * pricing.perImage;
  }
  if (usage.videoSecondsGenerated && pricing.perVideoSecond) {
    costUsd += usage.videoSecondsGenerated * pricing.perVideoSecond;
  }
  if (usage.audioSecondsGenerated && pricing.perAudioSecond) {
    costUsd += usage.audioSecondsGenerated * pricing.perAudioSecond;
  }

  return Math.round(costUsd * USD_TO_CHF * 10000) / 10000;
}
