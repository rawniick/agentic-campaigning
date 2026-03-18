import { NextRequest, NextResponse } from "next/server";
import { getCampaignById, trackApiUsage, updateCampaignStatus } from "@/lib/db/queries/campaigns";
import { getConceptsByCampaign, updateConcept } from "@/lib/db/queries/concepts";
import { createFeedbackMessage, getFeedbackMessages } from "@/lib/db/queries/feedback";
import { logAuditEvent } from "@/lib/db/queries/approvals";
import { mapCampaignToPromoInput } from "@/lib/mappers/campaign-to-promo-input";
import { buildPromptContext } from "@/lib/ai/brand-brain/context-builder";
import { buildConceptFeedbackResponderPrompt } from "@/lib/ai/prompts/concept-feedback-responder";
import { callClaude, estimateCostChf } from "@/lib/ai/claude";
import { feedbackResponseSchema } from "@/lib/schemas/campaign";
import { getAuthUser } from "@/lib/auth/get-user";
import type { CampaignStatus } from "@/types/database";

// POST /api/feedback — Feedback senden und Konzept verfeinern (v2 Flow)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { campaignId, phase, message } = await request.json();

    if (!campaignId || !phase || !message) {
      return NextResponse.json(
        { error: "campaignId, phase und message sind Pflicht" },
        { status: 400 }
      );
    }

    if (!["draft_concept", "detail_concept"].includes(phase)) {
      return NextResponse.json({ error: "Phase muss draft_concept oder detail_concept sein" }, { status: 400 });
    }

    const campaign = await getCampaignById(campaignId);

    if (campaign.flow_version !== 2) {
      return NextResponse.json({ error: "Feedback nur fuer v2-Kampagnen" }, { status: 400 });
    }

    // Status-Validierung: Feedback nur in passenden Phasen erlaubt
    const allowedStatuses: Record<string, CampaignStatus[]> = {
      draft_concept: ["draft_concept_generated", "draft_concept_feedback"],
      detail_concept: ["detail_concept_generated", "detail_concept_feedback"],
    };
    if (!allowedStatuses[phase]?.includes(campaign.status)) {
      return NextResponse.json(
        { error: `Feedback fuer ${phase} nicht moeglich im Status ${campaign.status}` },
        { status: 400 }
      );
    }

    // Aktuelles Konzept laden
    const concepts = await getConceptsByCampaign(campaignId);
    const conceptType = phase === "draft_concept" ? "draft" : "detail";
    const currentConcept = concepts
      .filter((c) => c.concept_type === conceptType)
      .sort((a, b) => b.iteration - a.iteration)[0];

    if (!currentConcept) {
      return NextResponse.json({ error: `Kein ${conceptType}-Konzept gefunden` }, { status: 400 });
    }

    // User-Feedback speichern
    await createFeedbackMessage(campaignId, phase, "user", message);

    // Feedback-Verlauf laden
    const feedbackHistory = await getFeedbackMessages(campaignId, phase);

    // Konzept als JSON fuer Prompt
    const conceptData: Record<string, unknown> = {
      leitidee: currentConcept.leitidee,
      claims: currentConcept.claims?.variants ?? [],
      hero_message: currentConcept.hero_message,
      key_visuals_direction: currentConcept.key_visual_direction,
      empfohlener_claim_index: currentConcept.recommended_claim_index ?? 0,
    };

    if (phase === "draft_concept") {
      conceptData.positionierung = currentConcept.positionierung;
      conceptData.kreativ_richtung = currentConcept.kreativ_richtung;
      conceptData.begruendung = currentConcept.begruendung;
    }

    // Prompt-Kontext bauen
    const promoInput = mapCampaignToPromoInput(campaign);
    const context = await buildPromptContext(promoInput, "de");

    const systemPrompt = buildConceptFeedbackResponderPrompt(
      context,
      campaign.brand,
      conceptData,
      feedbackHistory,
      phase
    );

    // Claude aufrufen (balanced temperature)
    const response = await callClaude<unknown>({
      systemPrompt,
      userMessage: `Neuestes Feedback vom Marketing-Team:\n\n"${message}"`,
      temperature: 0.5,
      maxTokens: 4096,
      taskType: "concept_feedback",
      campaignId,
      brand: campaign.brand,
    });

    // Zod-Validierung
    const parsed = feedbackResponseSchema.safeParse(response.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Feedback-Antwort ungueltig", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const feedbackResponse = parsed.data;
    const updatedConcept = feedbackResponse.aktualisiertes_konzept;

    // Konzept in DB aktualisieren (Iteration hochzaehlen)
    const newIteration = currentConcept.iteration + 1;
    await updateConcept(currentConcept.id, {
      leitidee: updatedConcept.leitidee,
      claims: {
        variants: updatedConcept.claims,
        recommended_index: updatedConcept.empfohlener_claim_index,
      },
      hero_message: updatedConcept.hero_message,
      key_visual_direction: updatedConcept.key_visuals_direction,
      recommended_claim_index: updatedConcept.empfohlener_claim_index,
      iteration: newIteration,
      ...(phase === "draft_concept" && "positionierung" in updatedConcept ? {
        positionierung: updatedConcept.positionierung ?? currentConcept.positionierung,
        kreativ_richtung: updatedConcept.kreativ_richtung ?? currentConcept.kreativ_richtung,
        begruendung: updatedConcept.begruendung ?? currentConcept.begruendung,
      } : {}),
    });

    // Assistant-Antwort speichern
    await createFeedbackMessage(
      campaignId,
      phase,
      "assistant",
      feedbackResponse.antwort,
      updatedConcept as unknown as Record<string, unknown>
    );

    // Status auf Feedback setzen
    const feedbackStatus: CampaignStatus =
      phase === "draft_concept" ? "draft_concept_feedback" : "detail_concept_feedback";
    await updateCampaignStatus(campaignId, feedbackStatus);

    // Kosten tracken
    const costChf = estimateCostChf(response.tokensUsed.input, response.tokensUsed.output);
    await trackApiUsage(campaignId, response.tokensUsed.total, costChf);
    await logAuditEvent(campaignId, "concept_feedback_processed", {
      phase,
      iteration: newIteration,
      changes: feedbackResponse.aenderungen,
      tokens_used: response.tokensUsed.total,
    });

    return NextResponse.json({
      message: feedbackResponse.antwort,
      changes: feedbackResponse.aenderungen,
      updatedConcept,
      iteration: newIteration,
      tokensUsed: response.tokensUsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
