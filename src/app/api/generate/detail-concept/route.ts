import { NextRequest, NextResponse } from "next/server";
import { getCampaignById, trackApiUsage, updateCampaignStatus } from "@/lib/db/queries/campaigns";
import { createConcept, getConceptsByCampaign } from "@/lib/db/queries/concepts";
import { createApproval, logAuditEvent } from "@/lib/db/queries/approvals";
import { mapCampaignToPromoInput } from "@/lib/mappers/campaign-to-promo-input";
import { buildPromptContext } from "@/lib/ai/brand-brain/context-builder";
import { buildDetailConceptGeneratorPrompt } from "@/lib/ai/prompts/detail-concept-generator";
import { callClaude, estimateCostChf } from "@/lib/ai/claude";
import { conceptOutputSchema } from "@/lib/schemas/campaign";
import { validatePrices } from "@/lib/ai/validation/price-validator";
import { validateCharLimits } from "@/lib/ai/validation/char-limit";
import { validateCompliance } from "@/lib/ai/validation/compliance";
import { loadGlossar } from "@/lib/ai/brand-brain/loader";
import { getAuthUser } from "@/lib/auth/get-user";

// POST /api/generate/detail-concept — Detailkonzept generieren (v2 Flow)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { campaignId } = await request.json();
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId ist Pflicht" }, { status: 400 });
    }

    const campaign = await getCampaignById(campaignId);

    if (campaign.flow_version !== 2) {
      return NextResponse.json({ error: "Detailkonzept nur fuer v2-Kampagnen" }, { status: 400 });
    }

    if (campaign.status !== "draft_concept_approved") {
      return NextResponse.json(
        { error: `Detailkonzept kann im Status "${campaign.status}" nicht generiert werden. Grobkonzept muss zuerst freigegeben sein.` },
        { status: 400 }
      );
    }

    // Freigegebenes Grobkonzept laden
    const concepts = await getConceptsByCampaign(campaignId);
    const draftConcept = concepts.find(
      (c) => c.concept_type === "draft" && c.is_selected
    );

    if (!draftConcept) {
      return NextResponse.json(
        { error: "Kein freigegebenes Grobkonzept gefunden" },
        { status: 400 }
      );
    }

    // PromoInput + Kontext
    const promoInput = mapCampaignToPromoInput(campaign);
    const context = await buildPromptContext(promoInput, "de");

    const systemPrompt = buildDetailConceptGeneratorPrompt(
      context,
      campaign.brand,
      {
        positionierung: draftConcept.positionierung ?? "",
        kreativ_richtung: draftConcept.kreativ_richtung ?? "",
        leitidee: draftConcept.leitidee ?? "",
        claims: draftConcept.claims?.variants ?? [],
        hero_message: draftConcept.hero_message ?? "",
        begruendung: draftConcept.begruendung ?? "",
        key_visuals_direction: draftConcept.key_visual_direction ?? "",
        empfohlener_claim_index: draftConcept.recommended_claim_index ?? 0,
      },
      campaign.channels
    );

    // Claude aufrufen (balanced)
    const response = await callClaude<unknown>({
      systemPrompt,
      userMessage: `Erstelle ein Detailkonzept mit Kanaladaptionen fuer ${campaign.promo_id}.\n\n${context.campaignContext}`,
      temperature: 0.5,
      maxTokens: 4096,
      taskType: "detail_concept_generator",
      campaignId,
      brand: campaign.brand,
    });

    // Zod-Validierung (selbes Schema wie v1 Konzept)
    const parsed = conceptOutputSchema.safeParse(response.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Detailkonzept-Output ungueltig", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const detailConcept = parsed.data;

    // Validierungs-Pipeline: Preis → CharLimit → Compliance
    const fullText = JSON.stringify(detailConcept);

    const priceResult = validatePrices(fullText, {
      price_new: promoInput.produktuebersicht.promoangebot.price_new,
      price_old: promoInput.produktuebersicht.promoangebot.price_old,
      currency: promoInput.produktuebersicht.promoangebot.currency,
      price_suffix: promoInput.produktuebersicht.promoangebot.price_suffix,
      discount_display: promoInput.produktuebersicht.promoangebot.discount_display,
      discount_value: promoInput.produktuebersicht.promoangebot.discount_value,
    });

    const charResult = validateCharLimits(detailConcept.kanaladaptionen as unknown as Record<string, unknown>);

    const glossar = await loadGlossar("de");
    const complianceResult = validateCompliance(fullText, promoInput, glossar);

    const hasCritical =
      !priceResult.valid ||
      !charResult.valid ||
      complianceResult.status === "FAIL";

    if (hasCritical) {
      return NextResponse.json({
        error: "Validierung fehlgeschlagen - Detailkonzept nicht gespeichert",
        validation: { prices: priceResult, charLimits: charResult, compliance: complianceResult },
        concept: detailConcept,
      }, { status: 422 });
    }

    // Speichern
    const savedConcept = await createConcept({
      campaign_id: campaignId,
      variant_label: "Detailkonzept",
      variant_index: 0,
      leitidee: detailConcept.kampagnensteckbrief.leitidee,
      claims: {
        variants: detailConcept.kampagnensteckbrief.claims,
        recommended_index: detailConcept.kampagnensteckbrief.empfohlener_claim_index,
      },
      hero_message: detailConcept.kampagnensteckbrief.hero_message,
      key_visual_direction: detailConcept.kampagnensteckbrief.key_visuals_direction,
      recommended_claim_index: detailConcept.kampagnensteckbrief.empfohlener_claim_index,
      channel_adaptations: detailConcept.kanaladaptionen,
      is_selected: true,
      prompt_version: detailConcept.metadata.prompt_version,
      tokens_used: response.tokensUsed.total,
      // v2-Felder
      concept_type: "detail",
      iteration: 1,
      parent_concept_id: draftConcept.id,
      positionierung: draftConcept.positionierung,
      kreativ_richtung: draftConcept.kreativ_richtung,
      begruendung: draftConcept.begruendung,
    });

    // Status + Approval
    await updateCampaignStatus(campaignId, "detail_concept_generated");
    await createApproval(campaignId, "detail_concept");

    // Kosten tracken
    const costChf = estimateCostChf(response.tokensUsed.input, response.tokensUsed.output);
    await trackApiUsage(campaignId, response.tokensUsed.total, costChf);
    await logAuditEvent(campaignId, "detail_concept_generated", {
      concept_id: savedConcept.id,
      draft_concept_id: draftConcept.id,
      tokens_used: response.tokensUsed.total,
      cost_chf: costChf,
    });

    return NextResponse.json({
      concept: savedConcept,
      validation: { prices: priceResult, charLimits: charResult, compliance: complianceResult },
      tokensUsed: response.tokensUsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
