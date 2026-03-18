import { NextRequest, NextResponse } from "next/server";
import { getCampaignById, trackApiUsage, updateCampaignStatus } from "@/lib/db/queries/campaigns";
import { createConcept } from "@/lib/db/queries/concepts";
import { createApproval, logAuditEvent } from "@/lib/db/queries/approvals";
import { mapCampaignToPromoInput } from "@/lib/mappers/campaign-to-promo-input";
import { buildPromptContext } from "@/lib/ai/brand-brain/context-builder";
import { buildDraftConceptGeneratorPrompt } from "@/lib/ai/prompts/draft-concept-generator";
import { callClaude, estimateCostChf } from "@/lib/ai/claude";
import { draftConceptOutputSchema } from "@/lib/schemas/campaign";
import { validatePrices } from "@/lib/ai/validation/price-validator";
import { getAuthUser } from "@/lib/auth/get-user";

// POST /api/generate/draft-concept — Grobkonzept generieren (v2 Flow)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { campaignId } = await request.json();
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId ist Pflicht" }, { status: 400 });
    }

    const campaign = await getCampaignById(campaignId);

    // Nur v2-Kampagnen im richtigen Status
    if (campaign.flow_version !== 2) {
      return NextResponse.json({ error: "Grobkonzept nur fuer v2-Kampagnen. Nutze /api/generate/concept fuer v1." }, { status: 400 });
    }

    if (!["input_confirmed", "strategy_selected", "strategies_generated"].includes(campaign.status)) {
      return NextResponse.json(
        { error: `Grobkonzept kann im Status "${campaign.status}" nicht generiert werden` },
        { status: 400 }
      );
    }

    // PromoInput rekonstruieren + Kontext bauen
    const promoInput = mapCampaignToPromoInput(campaign);
    const context = await buildPromptContext(promoInput, "de");

    // Gewaehlte Strategie laden
    let selectedStrategy: { direction: string; rationale: string; leitidee_preview: string } | undefined;
    if (campaign.selected_strategy_index !== null && campaign.strategy_options?.[campaign.selected_strategy_index]) {
      const strat = campaign.strategy_options[campaign.selected_strategy_index];
      selectedStrategy = {
        direction: strat.direction,
        rationale: strat.rationale,
        leitidee_preview: strat.leitidee_preview ?? "",
      };
    }

    const systemPrompt = buildDraftConceptGeneratorPrompt(context, campaign.brand, selectedStrategy);

    // Claude aufrufen (kreativ)
    const response = await callClaude<unknown>({
      systemPrompt,
      userMessage: `Erstelle ein Grobkonzept fuer die Kampagne ${campaign.promo_id}.\n\n${context.campaignContext}`,
      temperature: 0.7,
      maxTokens: 4096,
      taskType: "draft_concept_generator",
      campaignId,
      brand: campaign.brand,
    });

    // Zod-Validierung
    const parsed = draftConceptOutputSchema.safeParse(response.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Grobkonzept-Output ungueltig", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const draftConcept = parsed.data;

    // Preis-Validierung (Claims + Hero duerfen keine falschen Preise enthalten)
    const fullText = JSON.stringify(draftConcept);
    const priceResult = validatePrices(fullText, {
      price_new: promoInput.produktuebersicht.promoangebot.price_new,
      price_old: promoInput.produktuebersicht.promoangebot.price_old,
      currency: promoInput.produktuebersicht.promoangebot.currency,
      price_suffix: promoInput.produktuebersicht.promoangebot.price_suffix,
      discount_display: promoInput.produktuebersicht.promoangebot.discount_display,
      discount_value: promoInput.produktuebersicht.promoangebot.discount_value,
    });

    if (!priceResult.valid) {
      return NextResponse.json({
        error: "Preis-Validierung fehlgeschlagen",
        validation: { prices: priceResult },
        concept: draftConcept,
      }, { status: 422 });
    }

    // In concepts-Tabelle speichern
    const savedConcept = await createConcept({
      campaign_id: campaignId,
      variant_label: "Grobkonzept",
      variant_index: 0,
      leitidee: draftConcept.leitidee,
      claims: {
        variants: draftConcept.claims,
        recommended_index: draftConcept.empfohlener_claim_index,
      },
      hero_message: draftConcept.hero_message,
      key_visual_direction: draftConcept.key_visuals_direction,
      recommended_claim_index: draftConcept.empfohlener_claim_index,
      channel_adaptations: null,
      is_selected: true,
      prompt_version: "draft-concept-v1.0",
      tokens_used: response.tokensUsed.total,
      // v2-Felder
      concept_type: "draft",
      iteration: 1,
      parent_concept_id: null,
      positionierung: draftConcept.positionierung,
      kreativ_richtung: draftConcept.kreativ_richtung,
      begruendung: draftConcept.begruendung,
    });

    // Status + Approval
    await updateCampaignStatus(campaignId, "draft_concept_generated");
    await createApproval(campaignId, "draft_concept");

    // Kosten tracken
    const costChf = estimateCostChf(response.tokensUsed.input, response.tokensUsed.output);
    await trackApiUsage(campaignId, response.tokensUsed.total, costChf);
    await logAuditEvent(campaignId, "draft_concept_generated", {
      concept_id: savedConcept.id,
      tokens_used: response.tokensUsed.total,
      cost_chf: costChf,
    });

    return NextResponse.json({
      concept: savedConcept,
      validation: { prices: priceResult },
      tokensUsed: response.tokensUsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
