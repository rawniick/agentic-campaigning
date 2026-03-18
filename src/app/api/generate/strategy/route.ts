import { NextRequest, NextResponse } from "next/server";
import { getCampaignById, updateCampaign, trackApiUsage } from "@/lib/db/queries/campaigns";
import { logAuditEvent } from "@/lib/db/queries/approvals";
import { mapCampaignToPromoInput } from "@/lib/mappers/campaign-to-promo-input";
import { buildPromptContext } from "@/lib/ai/brand-brain/context-builder";
import { buildStrategyAdvisorPrompt } from "@/lib/ai/prompts/strategy-advisor";
import { callClaude, estimateCostChf } from "@/lib/ai/claude";
import { strategyOptionsSchema } from "@/lib/schemas/campaign";
import { getAuthUser } from "@/lib/auth/get-user";

// POST /api/generate/strategy - 2 strategische Richtungen generieren
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { campaignId } = await request.json();
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId ist Pflicht" }, { status: 400 });
    }

    // 1. Campaign laden und PromoInput rekonstruieren
    const campaign = await getCampaignById(campaignId);
    const promoInput = mapCampaignToPromoInput(campaign);

    // 2. Prompt-Kontext bauen
    const context = await buildPromptContext(promoInput, "de");
    const systemPrompt = buildStrategyAdvisorPrompt(context);

    // 3. Claude aufrufen (kreativ)
    const response = await callClaude<unknown>({
      systemPrompt,
      userMessage: `Erstelle 2 strategische Richtungen fuer die Kampagne ${campaign.promo_id}.\n\n${context.campaignContext}`,
      temperature: 0.7,
      maxTokens: 2048,
      taskType: "strategy_advisor",
      campaignId,
      brand: campaign.brand,
    });

    // 4. Output validieren
    const parsed = strategyOptionsSchema.safeParse(response.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Strategie-Output ungueltig", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    // 5. In Campaign speichern und Status updaten
    // v2-Kampagnen nutzen "strategies_generated", v1 nutzt "strategy_proposed"
    const newStatus = campaign.flow_version === 2 ? "strategies_generated" : "strategy_proposed";
    await updateCampaign(campaignId, {
      strategy_options: parsed.data.strategy_options.map((opt) => ({
        label: opt.label,
        direction: opt.direction,
        rationale: opt.rationale,
        leitidee_preview: opt.leitidee_preview,
        claim_preview: opt.claim_preview,
        tone: opt.tone,
        strength: opt.strength,
        risk: opt.risk,
      })),
      status: newStatus,
    });

    // 6. Kosten tracken + Audit
    const costChf = estimateCostChf(response.tokensUsed.input, response.tokensUsed.output);
    await trackApiUsage(campaignId, response.tokensUsed.total, costChf);
    await logAuditEvent(campaignId, "strategy_generated", {
      tokens_used: response.tokensUsed.total,
      cost_chf: costChf,
    });

    return NextResponse.json({
      strategy_options: parsed.data.strategy_options,
      recommendation: parsed.data.recommendation,
      recommendation_reason: parsed.data.recommendation_reason,
      tokensUsed: response.tokensUsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
