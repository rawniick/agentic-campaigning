import type { Db } from "../types";

export interface Asset {
  id: string;
  campaign_id: string;
  format_id: string;
  language: string;
  storage_url: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  status: string;
  vision_qa_score: number | null;
  vision_qa_details_json: Record<string, unknown> | null;
  position_overrides_json: Record<string, unknown> | null;
}

export interface CreateAssetInput {
  campaign_id: string;
  format_id: string;
  language: string;
  storage_url: string;
  file_size_bytes?: number;
  mime_type?: string;
  status?: string;
}

function normalize(row: Record<string, unknown>): Asset {
  return {
    ...(row as unknown as Asset),
    vision_qa_score:
      row.vision_qa_score === null ? null : Number(row.vision_qa_score),
  };
}

export async function createAsset(
  db: Db,
  input: CreateAssetInput
): Promise<Asset> {
  const res = await db.query<Record<string, unknown>>(
    `INSERT INTO assets
       (campaign_id, format_id, language, storage_url, file_size_bytes, mime_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'rendered'))
       RETURNING *`,
    [
      input.campaign_id,
      input.format_id,
      input.language,
      input.storage_url,
      input.file_size_bytes ?? null,
      input.mime_type ?? null,
      input.status ?? null,
    ]
  );
  return normalize(res.rows[0]);
}

export async function getAssetById(
  db: Db,
  id: string
): Promise<Asset | null> {
  const res = await db.query<Record<string, unknown>>(
    `SELECT * FROM assets WHERE id = $1 LIMIT 1`,
    [id]
  );
  return res.rows[0] ? normalize(res.rows[0]) : null;
}

export async function getAssetsForCampaign(
  db: Db,
  campaignId: string
): Promise<Asset[]> {
  const res = await db.query<Record<string, unknown>>(
    `SELECT * FROM assets WHERE campaign_id = $1 ORDER BY language, created_at`,
    [campaignId]
  );
  return res.rows.map(normalize);
}
