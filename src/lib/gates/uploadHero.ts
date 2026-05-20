import type { Db } from "../db/types";
import type { AssetStorage } from "../storage/types";
import { transitionGate, type CampaignState } from "../state/transitionGate";

export interface UploadHeroInput {
  campaignId: string;
  brandSlug: string;
  bytes: Buffer;
  contentType: string;
  filename: string;
}

// Gate-2-Action: Hero-Bild hochladen (V1 Phase 2 nur Upload, kein Library/AI).
// State-Transition: hero_pending -> layout_pending.
export async function uploadHero(
  db: Db,
  storage: AssetStorage,
  input: UploadHeroInput
): Promise<{ storage_url: string }> {
  if (input.bytes.length === 0) {
    throw new Error("Hero upload: bytes are empty");
  }

  const cur = await db.query<{ status: CampaignState }>(
    `SELECT status FROM campaigns WHERE id = $1`,
    [input.campaignId]
  );
  if (cur.rows.length === 0) {
    throw new Error(`Campaign ${input.campaignId} not found`);
  }
  const nextState = transitionGate(cur.rows[0].status, "HERO_SELECTED");

  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${input.brandSlug}/${input.campaignId}/hero-${Date.now()}-${safeName}`;
  const { url } = await storage.upload(key, input.bytes, input.contentType);

  await db.query(`BEGIN`);
  try {
    await db.query(
      `INSERT INTO campaign_hero
         (campaign_id, storage_url, source, file_size_bytes, mime_type, is_approved, approved_at)
         VALUES ($1, $2, 'upload', $3, $4, true, now())
         ON CONFLICT (campaign_id) DO UPDATE
           SET storage_url = EXCLUDED.storage_url,
               source = 'upload',
               file_size_bytes = EXCLUDED.file_size_bytes,
               mime_type = EXCLUDED.mime_type,
               is_approved = true,
               approved_at = now(),
               updated_at = now()`,
      [input.campaignId, url, input.bytes.length, input.contentType]
    );
    await db.query(`UPDATE campaigns SET status = $2, updated_at = now() WHERE id = $1`, [
      input.campaignId,
      nextState,
    ]);
    await db.query(`COMMIT`);
  } catch (e) {
    await db.query(`ROLLBACK`);
    throw e;
  }

  return { storage_url: url };
}
