import type { Db } from "../types";

export interface Asset {
  id: string;
  campaign_id: string;
  format_id: string;
  language: string;
  // null bei status='failed' (Render fehlgeschlagen, keine URL).
  storage_url: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  status: string;
  render_error: string | null;
  vision_qa_score: number | null;
  vision_qa_details_json: Record<string, unknown> | null;
  position_overrides_json: Record<string, unknown> | null;
  // Deterministischer Brand-Konformitaets-Gate (Migration 016).
  // false → nicht in den finalen ZIP-Export; null → noch nicht geprueft.
  conformity_pass: boolean | null;
  conformity_details_json: Record<string, unknown> | null;
}

export interface CreateAssetInput {
  campaign_id: string;
  format_id: string;
  language: string;
  storage_url: string;
  file_size_bytes?: number;
  mime_type?: string;
  status?: string;
  conformity_pass?: boolean | null;
  conformity_details?: Record<string, unknown> | null;
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
  // Upsert auf (campaign_id, format_id, language): macht Re-Runs und Einzel-Retry
  // idempotent — eine zuvor failed-Zeile wird auf 'rendered' gehoben, render_error
  // zurueckgesetzt.
  const res = await db.query<Record<string, unknown>>(
    `INSERT INTO assets
       (campaign_id, format_id, language, storage_url, file_size_bytes, mime_type, status, render_error, conformity_pass, conformity_details_json)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'rendered'), NULL, $8, $9::jsonb)
       ON CONFLICT (campaign_id, format_id, language) DO UPDATE
         SET storage_url = EXCLUDED.storage_url,
             file_size_bytes = EXCLUDED.file_size_bytes,
             mime_type = EXCLUDED.mime_type,
             status = EXCLUDED.status,
             render_error = NULL,
             -- COALESCE: ein Re-Insert OHNE Konformitaets-Input (EXCLUDED=NULL) darf
             -- ein vorhandenes Urteil nicht auf NULL zuruecksetzen (sonst wuerde es
             -- via 'IS NOT FALSE' wieder exportierbar). Re-Render uebergibt immer
             -- einen Wert und ueberschreibt dadurch korrekt.
             conformity_pass = COALESCE(EXCLUDED.conformity_pass, assets.conformity_pass),
             conformity_details_json = COALESCE(EXCLUDED.conformity_details_json, assets.conformity_details_json),
             updated_at = now()
       RETURNING *`,
    [
      input.campaign_id,
      input.format_id,
      input.language,
      input.storage_url,
      input.file_size_bytes ?? null,
      input.mime_type ?? null,
      input.status ?? null,
      input.conformity_pass ?? null,
      input.conformity_details ? JSON.stringify(input.conformity_details) : null,
    ]
  );
  return normalize(res.rows[0]);
}

export interface RecordFailedAssetInput {
  campaign_id: string;
  format_id: string;
  language: string;
  error: string;
}

// Persistiert eine fehlgeschlagene (Format x Sprache)-Kombination als
// status='failed'-Zeile (ohne storage_url) fuer Fehler-Badge + Retry.
export async function recordFailedAsset(
  db: Db,
  input: RecordFailedAssetInput
): Promise<Asset> {
  const res = await db.query<Record<string, unknown>>(
    `INSERT INTO assets
       (campaign_id, format_id, language, storage_url, status, render_error)
       VALUES ($1, $2, $3, NULL, 'failed', $4)
       RETURNING *`,
    [input.campaign_id, input.format_id, input.language, input.error]
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
