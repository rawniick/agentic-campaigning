import type { Db } from "../db/types";

// Multi-Sprach-Translation: nimmt die approved DE-Copy einer Kampagne und
// erzeugt FR/IT/EN-Varianten in einem einzigen Batch-LLM-Call. Disclaimer-
// IDs werden 1:1 vom DE-Source uebernommen — der Compliance-Pass-through
// erlaubt dem LLM nicht, Disclaimer zu beruehren.

export interface CopyTriple {
  headlines: string[];
  subline: string;
  cta_label: string;
}

export interface TranslateLLMResponse {
  fr: CopyTriple;
  it: CopyTriple;
  en: CopyTriple;
}

export interface TranslateLLMInput {
  sourceCopy: CopyTriple;
  passthroughTerms: string[];
}

export type TranslateLLMFn = (
  input: TranslateLLMInput
) => Promise<TranslateLLMResponse>;

export interface TranslateCampaignCopyInput {
  campaignId: string;
  passthroughTerms: string[];
  llm: TranslateLLMFn;
}

const TARGET_LANGUAGES = ["fr", "it", "en"] as const;

export async function translateCampaignCopy(
  db: Db,
  input: TranslateCampaignCopyInput
): Promise<void> {
  const sourceRes = await db.query<{
    headlines: string[];
    subline: string;
    cta_label: string;
    disclaimer_ids: string[];
    selected_headline_idx: number | null;
  }>(
    `SELECT headlines, subline, cta_label, disclaimer_ids, selected_headline_idx
       FROM campaign_copy
      WHERE campaign_id = $1 AND language = 'de' AND is_approved = true
      LIMIT 1`,
    [input.campaignId]
  );
  if (sourceRes.rows.length === 0) {
    throw new Error(`No approved DE copy for campaign ${input.campaignId}`);
  }
  const source = sourceRes.rows[0];

  const translated = await input.llm({
    sourceCopy: {
      headlines: source.headlines,
      subline: source.subline,
      cta_label: source.cta_label,
    },
    passthroughTerms: input.passthroughTerms,
  });

  for (const lang of TARGET_LANGUAGES) {
    const triple = translated[lang];
    await db.query(
      `INSERT INTO campaign_copy
         (campaign_id, language, headlines, subline, cta_label,
          disclaimer_ids, selected_headline_idx, is_approved, approved_at)
         VALUES ($1, $2, $3, $4, $5, $6::uuid[], $7, true, now())
       ON CONFLICT (campaign_id, language) DO UPDATE
         SET headlines = EXCLUDED.headlines,
             subline = EXCLUDED.subline,
             cta_label = EXCLUDED.cta_label,
             disclaimer_ids = EXCLUDED.disclaimer_ids,
             selected_headline_idx = EXCLUDED.selected_headline_idx,
             is_approved = EXCLUDED.is_approved,
             approved_at = EXCLUDED.approved_at,
             updated_at = now()`,
      [
        input.campaignId,
        lang,
        triple.headlines,
        triple.subline,
        triple.cta_label,
        source.disclaimer_ids,
        source.selected_headline_idx,
      ]
    );
  }
}
