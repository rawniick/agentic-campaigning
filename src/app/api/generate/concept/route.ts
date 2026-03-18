import { NextRequest, NextResponse } from "next/server";
import { getCampaignById, trackApiUsage, updateCampaignStatus } from "@/lib/db/queries/campaigns";
import { createConcept } from "@/lib/db/queries/concepts";
import { createApproval, logAuditEvent } from "@/lib/db/queries/approvals";
import { mapCampaignToPromoInput } from "@/lib/mappers/campaign-to-promo-input";
import { buildPromptContext } from "@/lib/ai/brand-brain/context-builder";
import { buildConceptGeneratorPrompt } from "@/lib/ai/prompts/concept-generator";
import { callClaude, estimateCostChf } from "@/lib/ai/claude";
import { conceptOutputSchema } from "@/lib/schemas/campaign";
import { validatePrices } from "@/lib/ai/validation/price-validator";
import { validateCharLimits } from "@/lib/ai/validation/char-limit";
import { validateCompliance } from "@/lib/ai/validation/compliance";
import { loadGlossar } from "@/lib/ai/brand-brain/loader";
import { getAuthUser } from "@/lib/auth/get-user";

// POST /api/generate/concept - Konzept generieren mit Validierungs-Pipeline
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { campaignId, strategyIndex } = await request.json();
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId ist Pflicht" }, { status: 400 });
    }

    // 1. Campaign laden und PromoInput rekonstruieren
    const campaign = await getCampaignById(campaignId);

    // v2-Kampagnen muessen draft-concept / detail-concept nutzen
    if (campaign.flow_version === 2) {
      return NextResponse.json(
        { error: "v2-Kampagnen nutzen /api/generate/draft-concept und /api/generate/detail-concept" },
        { status: 400 }
      );
    }

    const promoInput = mapCampaignToPromoInput(campaign);

    // Strategie-Richtung in Claim-Direction uebernehmen
    if (strategyIndex !== undefined && campaign.strategy_options?.[strategyIndex]) {
      const selected = campaign.strategy_options[strategyIndex];
      promoInput.vermarktung.claim_direction = selected.direction as typeof promoInput.vermarktung.claim_direction;
    }

    // 2. Prompt-Kontext und System-Prompt bauen
    const context = await buildPromptContext(promoInput, "de");
    const systemPrompt = await buildConceptGeneratorPrompt(context, campaign.brand);

    // 3. Claude aufrufen (kreativ)
    const response = await callClaude<unknown>({
      systemPrompt,
      userMessage: `Generiere ein Konzept fuer die Kampagne ${campaign.promo_id}.\n\n${context.campaignContext}`,
      temperature: 0.7,
      maxTokens: 4096,
      taskType: "concept_generator",
      campaignId,
      brand: campaign.brand,
    });

    // 4. Zod-Validierung
    const parsed = conceptOutputSchema.safeParse(response.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Konzept-Output ungueltig", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const concept = parsed.data;

    // 5. Validierungs-Pipeline: Preis -> CharLimit -> Compliance
    const fullText = JSON.stringify(concept);

    const priceResult = validatePrices(fullText, {
      price_new: promoInput.produktuebersicht.promoangebot.price_new,
      price_old: promoInput.produktuebersicht.promoangebot.price_old,
      currency: promoInput.produktuebersicht.promoangebot.currency,
      price_suffix: promoInput.produktuebersicht.promoangebot.price_suffix,
      discount_display: promoInput.produktuebersicht.promoangebot.discount_display,
      discount_value: promoInput.produktuebersicht.promoangebot.discount_value,
    });

    const charResult = validateCharLimits(concept.kanaladaptionen as unknown as Record<string, unknown>);

    const glossar = await loadGlossar("de");
    const complianceResult = validateCompliance(fullText, promoInput, glossar);

    // Bei CRITICAL: Fehler zurueckgeben, nicht speichern
    const hasCritical =
      !priceResult.valid ||
      !charResult.valid ||
      complianceResult.status === "FAIL";

    if (hasCritical) {
      return NextResponse.json({
        error: "Validierung fehlgeschlagen - Konzept nicht gespeichert",
        validation: {
          prices: priceResult,
          charLimits: charResult,
          compliance: complianceResult,
        },
        concept,
      }, { status: 422 });
    }

    // 6. In concepts-Tabelle speichern
    const variantLabel = strategyIndex !== undefined
      ? `Variante ${strategyIndex + 1}`
      : "Standard";

    const savedConcept = await createConcept({
      campaign_id: campaignId,
      variant_label: variantLabel,
      variant_index: strategyIndex ?? 0,
      leitidee: concept.kampagnensteckbrief.leitidee,
      claims: {
        variants: concept.kampagnensteckbrief.claims,
        recommended_index: concept.kampagnensteckbrief.empfohlener_claim_index,
      },
      hero_message: concept.kampagnensteckbrief.hero_message,
      key_visual_direction: concept.kampagnensteckbrief.key_visuals_direction,
      recommended_claim_index: concept.kampagnensteckbrief.empfohlener_claim_index,
      channel_adaptations: concept.kanaladaptionen,
      is_selected: true,
      prompt_version: concept.metadata.prompt_version,
      tokens_used: response.tokensUsed.total,
      // v2-Felder (Defaults fuer v1-Kampagnen)
      concept_type: "legacy",
      iteration: 1,
      parent_concept_id: null,
      positionierung: null,
      kreativ_richtung: null,
      begruendung: null,
    });

    // 7. Status updaten und Approval erstellen
    await updateCampaignStatus(campaignId, "concept_generated");
    await createApproval(campaignId, "concept");

    // 8. Kosten tracken + Audit
    const costChf = estimateCostChf(response.tokensUsed.input, response.tokensUsed.output);
    await trackApiUsage(campaignId, response.tokensUsed.total, costChf);
    await logAuditEvent(campaignId, "concept_generated", {
      concept_id: savedConcept.id,
      tokens_used: response.tokensUsed.total,
      cost_chf: costChf,
      validation_warnings: charResult.warnings.length + complianceResult.warnings.length,
    });

    return NextResponse.json({
      concept: savedConcept,
      validation: {
        prices: priceResult,
        charLimits: charResult,
        compliance: complianceResult,
      },
      tokensUsed: response.tokensUsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
