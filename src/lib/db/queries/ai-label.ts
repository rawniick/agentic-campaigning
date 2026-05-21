import type { Db } from "../types";
import type { AiLabelPosition } from "./format-specs";

export interface AiLabelAsset {
  brand_id: string;
  storage_url: string;
  default_position: AiLabelPosition;
  created_at: string;
  updated_at: string;
}

export interface UpsertAiLabelAssetInput {
  brand_id: string;
  storage_url: string;
  default_position: AiLabelPosition;
}

// Eine Zeile pro Brand. Upsert ueberschreibt URL + Default-Position atomar.
// updated_at wird beim Update geknallt damit Cache-Invalidierung im Frontend
// einen Anker hat.
export async function upsertAiLabelAsset(
  db: Db,
  input: UpsertAiLabelAssetInput
): Promise<void> {
  await db.query(
    `INSERT INTO ai_label_assets (brand_id, storage_url, default_position)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (brand_id) DO UPDATE
         SET storage_url = EXCLUDED.storage_url,
             default_position = EXCLUDED.default_position,
             updated_at = now()`,
    [input.brand_id, input.storage_url, JSON.stringify(input.default_position)]
  );
}

export async function getAiLabelAsset(
  db: Db,
  brandId: string
): Promise<AiLabelAsset | null> {
  const res = await db.query<AiLabelAsset>(
    `SELECT * FROM ai_label_assets WHERE brand_id = $1 LIMIT 1`,
    [brandId]
  );
  return res.rows[0] ?? null;
}
