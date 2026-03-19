import { NextRequest, NextResponse } from "next/server";
import { getCampaignById, trackApiUsage, updateCampaignStatus } from "@/lib/db/queries/campaigns";
import { getSelectedConcept } from "@/lib/db/queries/concepts";
import { createTranslation } from "@/lib/db/queries/translations";
import { createApproval, logAuditEvent } from "@/lib/db/queries/approvals";
import { mapCampaignToPromoInput } from "@/lib/mappers/campaign-to-promo-input";
import { buildPromptContext } from "@/lib/ai/brand-brain/context-builder";
import { buildTranslatorPrompt, type TargetLanguage } from "@/lib/ai/prompts/translator";
import { callClaude, estimateCostChf } from "@/lib/ai/claude";
import { validateCharLimits, adjustLimitsForLanguage } from "@/lib/ai/validation/char-limit";
import { validatePrices } from "@/lib/ai/validation/price-validator";
import { validateCompliance } from "@/lib/ai/validation/compliance";
import { loadGlossar } from "@/lib/ai/brand-brain/loader";
import { getAuthUser } from "@/lib/auth/get-user";
import { z } from "zod";

// Schema fuer Uebersetzungs-Output (akzeptiert beide Claude-Formate)
const translationOutputSchema = z.object({
  target_language: z.string(),
  translated_claims: z.array(z.string()),
  translated_hero_message: z.string(),
  translated_channel_adaptations: z.record(z.string(), z.unknown()).optional(),
  translated_disclaimer: z.string().nullable().optional(),
  glossar_terms_used: z.array(z.record(z.string(), z.string())).optional(),
  translation_notes: z.union([z.array(z.string()), z.record(z.string(), z.unknown())]).optional(),
});

// Claude gibt manchmal ein alternatives Format zurueck — normalisieren
function normalizeTranslationOutput(data: Record<string, unknown>, lang: string): Record<string, unknown> {
  // Format A: Erwartet (target_language, translated_claims, ...)
  if (data.target_language && data.translated_claims) return data;

  // Format B: Claude-Format (language, translations: { claims, hero_message, ... })
  if (data.translations && typeof data.translations === "object") {
    const t = data.translations as Record<string, unknown>;
    return {
      target_language: (data.language as string) ?? lang,
      translated_claims: t.claims ?? [],
      translated_hero_message: t.hero_message ?? "",
      translated_channel_adaptations: t.channel_adaptations ?? undefined,
      translated_disclaimer: t.disclaimer ?? undefined,
      glossar_terms_used: (data.glossar_terms_used ?? t.glossar_terms_used) as unknown[] | undefined,
      translation_notes: (data.quality_notes ?? data.translation_notes ?? t.translation_notes) as string[] | undefined,
    };
  }

  // Format C: Flaches Format ohne Prefix (language, claims, hero_message)
  if (data.claims && data.hero_message) {
    return {
      target_language: (data.language ?? data.target_language ?? lang) as string,
      translated_claims: data.claims,
      translated_hero_message: data.hero_message,
      translated_channel_adaptations: data.channel_adaptations ?? undefined,
      translated_disclaimer: data.disclaimer ?? undefined,
      glossar_terms_used: data.glossar_terms_used as unknown[] | undefined,
      translation_notes: (data.quality_notes ?? data.translation_notes) as string[] | undefined,
    };
  }

  return data;
}

// POST /api/generate/translate - DE->FR/IT/EN Uebersetzung mit Glossar
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { campaignId, targetLanguages } = await request.json();
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId ist Pflicht" }, { status: 400 });
    }

    const campaign = await getCampaignById(campaignId);
    const promoInput = mapCampaignToPromoInput(campaign);
    const concept = await getSelectedConcept(campaignId);

    if (!concept) {
      return NextResponse.json(
        { error: "Kein genehmigtes Konzept gefunden" },
        { status: 400 }
      );
    }

    // Standard: Alle Sprachen ausser DE
    const languages: TargetLanguage[] = targetLanguages
      ?? campaign.languages.filter((l): l is TargetLanguage => l !== "de");

    await updateCampaignStatus(campaignId, "translating");

    const results = [];
    let totalTokens = 0;
    let totalCost = 0;

    // Jede Sprache sequenziell uebersetzen (Glossar-spezifisch)
    for (const lang of languages) {
      const context = await buildPromptContext(promoInput, lang);
      const systemPrompt = await buildTranslatorPrompt(
        context,
        lang,
        campaign.brand
      );

      // Quelltext zusammenbauen
      const sourceText = JSON.stringify({
        claims: concept.claims?.variants ?? [],
        hero_message: concept.hero_message,
        channel_adaptations: concept.channel_adaptations,
        disclaimer: campaign.disclaimer_text,
      });

      const response = await callClaude<unknown>({
        systemPrompt,
        userMessage: `Uebersetze den folgenden DE-Content nach ${lang.toUpperCase()}:\n\n${sourceText}`,
        temperature: 0.3,
        maxTokens: 4096,
        taskType: "translator",
        campaignId,
        brand: campaign.brand,
      });

      const normalized = normalizeTranslationOutput(response.data as Record<string, unknown>, lang);
      const parsed = translationOutputSchema.safeParse(normalized);
      if (!parsed.success) {
        console.warn(`[Translate] Zod-Validierung fehlgeschlagen fuer ${lang}:`, parsed.error.flatten());
        results.push({ language: lang, error: "Output-Validierung fehlgeschlagen", details: parsed.error.flatten() });
        continue;
      }

      const output = parsed.data;

      // Zeichenlimits pruefen (sprach-angepasst fuer FR/IT)
      const charResult = output.translated_channel_adaptations
        ? validateCharLimits(output.translated_channel_adaptations as Record<string, unknown>, lang)
        : { valid: true, warnings: [] };

      // Preis-Validierung: Preise muessen exakt erhalten bleiben
      const translatedText = [
        ...output.translated_claims,
        output.translated_hero_message,
        output.translated_disclaimer ?? "",
        JSON.stringify(output.translated_channel_adaptations ?? {}),
      ].join(" ");
      const priceResult = validatePrices(translatedText, {
        price_new: promoInput.produktuebersicht.promoangebot.price_new,
        price_old: promoInput.produktuebersicht.promoangebot.price_old,
        currency: promoInput.produktuebersicht.promoangebot.currency,
        price_suffix: promoInput.produktuebersicht.promoangebot.price_suffix,
        discount_display: promoInput.produktuebersicht.promoangebot.discount_display,
        discount_value: promoInput.produktuebersicht.promoangebot.discount_value,
      });

      // Compliance: Disclaimer, 5G Badge, Swisscom Netz + Glossar
      const glossar = await loadGlossar(lang);
      const complianceResult = validateCompliance(translatedText, promoInput, glossar);

      // Bei kritischen Compliance-Fehlern: Warnung loggen aber fortfahren
      // (Uebersetzung wird gespeichert, Reviewer sieht Warnings)
      if (complianceResult.status === "FAIL") {
        console.warn(
          `[Translate] Compliance FAIL fuer ${lang}:`,
          complianceResult.criticalIssues
        );
      }

      // In DB speichern
      const translation = await createTranslation({
        campaign_id: campaignId,
        concept_id: concept.id,
        source_language: "de",
        target_language: lang,
        translated_claims: {
          variants: output.translated_claims,
          recommended_index: concept.recommended_claim_index ?? 0,
        },
        translated_hero_message: output.translated_hero_message,
        translated_channel_adaptations: output.translated_channel_adaptations as typeof concept.channel_adaptations ?? null,
        translated_disclaimer: output.translated_disclaimer ?? null,
        glossar_terms_used: output.glossar_terms_used ?? null,
        char_limit_warnings: charResult.warnings.map((w) => ({
          field: w.field,
          limit: w.limit,
          actual: w.actual,
          text: w.text,
        })),
        quality_confidence: "high",
        approval_status: "pending",
        reviewer_notes: null,
        prompt_version: "translator-1.0",
        tokens_used: response.tokensUsed.total,
      });

      const costChf = estimateCostChf(response.tokensUsed.input, response.tokensUsed.output);
      totalTokens += response.tokensUsed.total;
      totalCost += costChf;

      results.push({
        language: lang,
        translation,
        charLimitWarnings: charResult.warnings,
        priceValidation: priceResult,
        complianceResult,
      });
    }

    // Kosten tracken
    await trackApiUsage(campaignId, totalTokens, totalCost);

    // Erfolgreiche und fehlgeschlagene Sprachen zaehlen
    const successfulLangs = results.filter((r) => !("error" in r));
    const failedLangs = results.filter((r) => "error" in r);

    if (successfulLangs.length > 0) {
      // Mindestens 1 Sprache erfolgreich: Status updaten + Approval erstellen
      await updateCampaignStatus(campaignId, "translations_ready");
      await createApproval(campaignId, "translations");
      await logAuditEvent(campaignId, "translations_generated", {
        languages,
        successful: successfulLangs.length,
        failed: failedLangs.length,
        total_tokens: totalTokens,
        total_cost_chf: totalCost,
      });
    } else {
      // Alle fehlgeschlagen: zurueck zu concept_approved
      await updateCampaignStatus(campaignId, "concept_approved");
      await logAuditEvent(campaignId, "translations_failed", {
        languages,
        errors: failedLangs.map((r) => ({ language: r.language, error: r.error })),
      });
    }

    return NextResponse.json({
      translations: results,
      totalTokens,
      totalCost,
      partial: failedLangs.length > 0 && successfulLangs.length > 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
