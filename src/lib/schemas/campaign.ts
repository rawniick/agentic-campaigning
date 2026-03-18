import { z } from "zod";

// Campaign Status Enum
export const campaignStatusSchema = z.enum([
  "draft",
  "input_complete",
  "strategy_proposed",
  "strategy_selected",
  "concept_generated",
  "concept_approved",
  "translating",
  "translations_ready",
  "translations_approved",
  "rendering_assets",
  "assets_ready",
  "assets_approved",
  "distributing",
  "published",
  "archived",
  // v2 Flow
  "input_review",
  "input_confirmed",
  "strategies_generated",
  "draft_concept_generated",
  "draft_concept_feedback",
  "draft_concept_approved",
  "detail_concept_generated",
  "detail_concept_feedback",
  "detail_concept_approved",
]);

export const approvalStageSchema = z.enum(["concept", "translations", "assets", "draft_concept", "detail_concept"]);
export const conceptTypeSchema = z.enum(["draft", "detail", "legacy"]);
export const approvalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "revision_requested",
]);

// Schema fuer Konzept-Generator Output
export const conceptOutputSchema = z.object({
  kampagnensteckbrief: z.object({
    leitidee: z.string(),
    claims: z.array(z.string()).min(3).max(5),
    hero_message: z.string(),
    key_visuals_direction: z.string(),
    empfohlener_claim_index: z.number().int().min(0),
  }),
  kanaladaptionen: z.object({
    social: z
      .object({
        hook: z.string(),
        body: z.string(),
        cta: z.string(),
        hashtags: z.array(z.string()),
      })
      .optional(),
    crm: z
      .object({
        subject_line: z.string(),
        preview_text: z.string(),
        headline: z.string(),
        body: z.string(),
        cta: z.string(),
      })
      .optional(),
    website: z
      .object({
        hero_headline: z.string(),
        hero_subline: z.string(),
        cta_primary: z.string(),
        cta_secondary: z.string().optional(),
      })
      .optional(),
    sea: z
      .object({
        headlines: z.array(z.string().max(30)).min(3).max(5),
        descriptions: z.array(z.string().max(90)).min(2).max(3),
      })
      .optional(),
    print: z
      .object({
        headline: z.string(),
        subline: z.string(),
        body: z.string(),
        pflichttext: z.string(),
      })
      .optional(),
  }),
  compliance_check: z.object({
    disclaimer_included: z.boolean(),
    five_g_badge_required: z.boolean(),
    price_verified: z.boolean(),
    notes: z.array(z.string()).optional(),
  }),
  metadata: z.object({
    promo_id: z.string(),
    generated_at: z.string(),
    prompt_version: z.string(),
    claim_direction_used: z.string(),
  }),
});

// Schema fuer Strategie-Vorschlaege
export const strategyOptionsSchema = z.object({
  strategy_options: z
    .array(
      z.object({
        label: z.string(),
        direction: z.string(),
        rationale: z.string(),
        leitidee_preview: z.string(),
        claim_preview: z.string(),
        tone: z.string(),
        strength: z.string(),
        risk: z.string(),
      })
    )
    .length(2),
  recommendation: z.number().int().min(0).max(1),
  recommendation_reason: z.string(),
});

// Schema fuer Compliance-Checker Output
export const complianceOutputSchema = z.object({
  overall_status: z.enum(["PASS", "FAIL", "WARNING"]),
  critical_issues: z.array(
    z.object({
      type: z.string(),
      field: z.string(),
      expected: z.string(),
      found: z.string(),
      severity: z.literal("CRITICAL"),
    })
  ),
  warnings: z.array(
    z.object({
      type: z.string(),
      field: z.string(),
      details: z.string(),
      severity: z.literal("WARNING"),
    })
  ),
  passed_checks: z.number().int(),
  total_checks: z.number().int(),
  recommendation: z.enum(["APPROVE", "REVISE", "BLOCK"]),
});

// v2: Grobkonzept Output Schema (ohne Kanaladaptionen)
export const draftConceptOutputSchema = z.object({
  positionierung: z.string(),
  kreativ_richtung: z.string(),
  leitidee: z.string(),
  claims: z.array(z.string()).min(3).max(5),
  hero_message: z.string(),
  begruendung: z.string(),
  key_visuals_direction: z.string(),
  empfohlener_claim_index: z.number().int().min(0),
});

// v2: Feedback-Antwort Schema
export const feedbackResponseSchema = z.object({
  antwort: z.string(),
  aenderungen: z.array(z.string()),
  aktualisiertes_konzept: draftConceptOutputSchema.or(conceptOutputSchema.shape.kampagnensteckbrief.extend({
    positionierung: z.string().optional(),
    kreativ_richtung: z.string().optional(),
    begruendung: z.string().optional(),
  })),
});

export type CampaignStatusType = z.infer<typeof campaignStatusSchema>;
export type ConceptOutput = z.infer<typeof conceptOutputSchema>;
export type DraftConceptOutput = z.infer<typeof draftConceptOutputSchema>;
export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>;
export type StrategyOptions = z.infer<typeof strategyOptionsSchema>;
export type ComplianceOutput = z.infer<typeof complianceOutputSchema>;
