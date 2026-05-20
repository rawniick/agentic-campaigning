import type { Db } from "../db/types";

// Vision-QA: bewertet ein gerendertes Asset gegen vier Brand-Konformitaets-
// Checks. Score 0..1, Details als JSON (Checks pro Achse + optionale Notes).
// LLM-Aufruf via injizierbarem Client — in Tests gemockt, in Production
// gegen Claude Vision.

export interface VisionQAChecks {
  logo_bounds: number;
  color_match: number;
  safezone: number;
  style_consistency: number;
}

export interface VisionQAResult {
  score: number;
  checks: VisionQAChecks;
  notes?: string;
}

export interface VisionQAClientInput {
  imageBytes: Buffer;
  imageMimeType: string;
  brandPrimaryHex: string;
  formatCode: string;
}

export interface VisionQAClient {
  analyze(input: VisionQAClientInput): Promise<VisionQAResult>;
}

export interface RunVisionQAInput {
  assetId: string;
  imageBytes: Buffer;
  imageMimeType: string;
  brandPrimaryHex: string;
  formatCode: string;
}

export async function runVisionQA(
  db: Db,
  client: VisionQAClient,
  input: RunVisionQAInput
): Promise<VisionQAResult> {
  const result = await client.analyze({
    imageBytes: input.imageBytes,
    imageMimeType: input.imageMimeType,
    brandPrimaryHex: input.brandPrimaryHex,
    formatCode: input.formatCode,
  });

  await db.query(
    `UPDATE assets
        SET vision_qa_score = $2,
            vision_qa_details_json = $3::jsonb,
            updated_at = now()
      WHERE id = $1`,
    [input.assetId, result.score, JSON.stringify(result)]
  );

  return result;
}
