import { NextRequest, NextResponse } from "next/server";
import { getCampaignById, trackApiUsage, updateCampaignStatus } from "@/lib/db/queries/campaigns";
import { getSelectedConcept, updateConcept } from "@/lib/db/queries/concepts";
import { createFeedbackMessage, getFeedbackMessages } from "@/lib/db/queries/feedback";
import { logAuditEvent } from "@/lib/db/queries/audit";
import { mapCampaignToPromoInput } from "@/lib/mappers/campaign-to-promo-input";
import { buildPromptContext } from "@/lib/ai/brand-brain/context-builder";
import { buildConceptFeedbackResponderPrompt } from "@/lib/ai/prompts/concept-feedback-responder";
import { callClaude, estimateCostChf } from "@/lib/ai/claude";
import { feedbackResponseSchema } from "@/lib/schemas/campaign";
import { getAuthUser } from "@/lib/auth/get-user";

// POST /api/feedback — Feedback senden und Konzept iterativ verfeinern
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { campaignId, message } = await request.json();

    if (!campaignId || !message) {
      return NextResponse.json(
        { error: "campaignId und message sind Pflicht" },
        { status: 400 }
      );
    }

    const campaign = await getCampaignById(campaignId);

    // Feedback nur in Konzept-Phase
    if (!["concept_generated", "concept_feedback"].includes(campaign.status)) {
      return NextResponse.json(
        { error: `Feedback nicht moeglich im Status ${campaign.status}` },
        { status: 400 }
      );
    }

    const currentConcept = await getSelectedConcept(campaignId);
    if (!currentConcept) {
      return NextResponse.json({ error: "Kein Konzept gefunden" }, { status: 400 });
    }

    // User-Feedback speichern
    await createFeedbackMessage(campaignId, "concept", "user", message);

    // Feedback-Verlauf laden
    const feedbackHistory = await getFeedbackMessages(campaignId, "concept");

    // Konzept als JSON fuer Prompt
    const conceptData: Record<string, unknown> = {
      leitidee: currentConcept.leitidee,
      claims: currentConcept.claims?.variants ?? [],
      hero_message: currentConcept.hero_message,
      key_visuals_direction: currentConcept.key_visual_direction,
      empfohlener_claim_index: currentConcept.recommended_claim_index ?? 0,
    };

    const promoInput = mapCampaignToPromoInput(campaign);
    const context = await buildPromptContext(promoInput, "de");

    const systemPrompt = buildConceptFeedbackResponderPrompt(
      context,
      campaign.brand,
      conceptData,
      feedbackHistory
    );

    const response = await callClaude<unknown>({
      systemPrompt,
      userMessage: `Neuestes Feedback vom Marketing-Team:\n\n"${message}"`,
      temperature: 0.5,
      maxTokens: 4096,
      taskType: "concept_feedback",
      campaignId,
      brand: campaign.brand,
    });

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
    });

    // Assistant-Antwort speichern
    await createFeedbackMessage(
      campaignId,
      "concept",
      "assistant",
      feedbackResponse.antwort,
      updatedConcept as unknown as Record<string, unknown>
    );

    // Status auf concept_feedback (zeigt: User hat iteriert)
    await updateCampaignStatus(campaignId, "concept_feedback");

    // Kosten tracken
    const costChf = estimateCostChf(response.tokensUsed.input, response.tokensUsed.output);
    await trackApiUsage(campaignId, response.tokensUsed.total, costChf);
    await logAuditEvent(campaignId, "concept_feedback_processed", {
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
