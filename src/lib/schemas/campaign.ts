import { z } from "zod";

// Campaign Status Enum (V3 — Branch X)
export const campaignStatusSchema = z.enum([
  "draft",
  "input_complete",
  "concept_generated",
  "concept_feedback",
  "concept_approved",
  "translating",
  "translations_ready",
  "rendering_assets",
  "assets_ready",
  "assets_approved",
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

// Feedback-Antwort Schema (Konzept-Iteration via Chat)
export const feedbackResponseSchema = z.object({
  antwort: z.string(),
  aenderungen: z.array(z.string()),
  aktualisiertes_konzept: conceptOutputSchema.shape.kampagnensteckbrief,
});

export type CampaignStatusType = z.infer<typeof campaignStatusSchema>;
export type ConceptOutput = z.infer<typeof conceptOutputSchema>;
export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>;
export type ComplianceOutput = z.infer<typeof complianceOutputSchema>;
