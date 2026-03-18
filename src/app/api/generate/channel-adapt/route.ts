import { NextRequest, NextResponse } from "next/server";
import { getCampaignById, trackApiUsage } from "@/lib/db/queries/campaigns";
import { getSelectedConcept, updateConcept } from "@/lib/db/queries/concepts";
import { logAuditEvent } from "@/lib/db/queries/approvals";
import { mapCampaignToPromoInput } from "@/lib/mappers/campaign-to-promo-input";
import { buildPromptContext } from "@/lib/ai/brand-brain/context-builder";
import { buildChannelAdapterPrompt } from "@/lib/ai/prompts/channel-adapter";
import { callClaude, estimateCostChf } from "@/lib/ai/claude";
import { validateCharLimits } from "@/lib/ai/validation/char-limit";
import { validatePrices } from "@/lib/ai/validation/price-validator";
import { getAuthUser } from "@/lib/auth/get-user";
import { z } from "zod";

// Schema fuer Channel-Adapter Output
const channelAdaptOutputSchema = z.object({
  kanaladaptionen: z.record(z.string(), z.unknown()),
});

// POST /api/generate/channel-adapt - Kanaladaptionen generieren
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { campaignId, channels } = await request.json();
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId ist Pflicht" }, { status: 400 });
    }

    const campaign = await getCampaignById(campaignId);
    const promoInput = mapCampaignToPromoInput(campaign);
    const concept = await getSelectedConcept(campaignId);

    if (!concept) {
      return NextResponse.json(
        { error: "Kein ausgewaehltes Konzept gefunden" },
        { status: 400 }
      );
    }

    // Kanaele: aus Request oder von Campaign
    const targetChannels: string[] = channels ?? campaign.channels;

    const context = await buildPromptContext(promoInput, "de");
    const systemPrompt = buildChannelAdapterPrompt(context, targetChannels, {
      leitidee: concept.leitidee ?? "",
      claims: concept.claims?.variants ?? [],
      hero_message: concept.hero_message ?? "",
    });

    const response = await callClaude<unknown>({
      systemPrompt,
      userMessage: `Adaptiere das Konzept fuer: ${targetChannels.join(", ")}\n\n${context.campaignContext}`,
      temperature: 0.7,
      maxTokens: 4096,
      taskType: "channel_adapter",
      campaignId,
      brand: campaign.brand,
    });

    const parsed = channelAdaptOutputSchema.safeParse(response.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Channel-Adapter Output ungueltig", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    // Validierungs-Pipeline: Preis -> CharLimit
    const adaptText = JSON.stringify(parsed.data.kanaladaptionen);
    const priceResult = validatePrices(adaptText, {
      price_new: promoInput.produktuebersicht.promoangebot.price_new,
      price_old: promoInput.produktuebersicht.promoangebot.price_old,
      currency: promoInput.produktuebersicht.promoangebot.currency,
      price_suffix: promoInput.produktuebersicht.promoangebot.price_suffix,
      discount_display: promoInput.produktuebersicht.promoangebot.discount_display,
      discount_value: promoInput.produktuebersicht.promoangebot.discount_value,
    });
    const charResult = validateCharLimits(parsed.data.kanaladaptionen as Record<string, unknown>);

    // Ergebnis im Concept speichern
    await updateConcept(concept.id, {
      channel_adaptations: parsed.data.kanaladaptionen as Record<string, unknown>,
    });

    // Kosten tracken
    const costChf = estimateCostChf(response.tokensUsed.input, response.tokensUsed.output);
    await trackApiUsage(campaignId, response.tokensUsed.total, costChf);
    await logAuditEvent(campaignId, "channel_adaptations_generated", {
      concept_id: concept.id,
      channels: targetChannels,
      tokens_used: response.tokensUsed.total,
      cost_chf: costChf,
    });

    return NextResponse.json({
      kanaladaptionen: parsed.data.kanaladaptionen,
      priceValidation: priceResult,
      charLimitWarnings: charResult.warnings,
      tokensUsed: response.tokensUsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
