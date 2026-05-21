import type { Db } from "../db/types";
import { transitionGate, type CampaignState } from "../state/transitionGate";

export interface SelectHeroFromLibraryInput {
  campaignId: string;
  libraryEntryId: string;
}

// Gate-2-Action: User waehlt ein Hero aus der Library statt eigenes Bild
// hochzuladen. Speichert library_id + Snapshot der storage_url, damit Loeschungen
// in der Library nicht den Render-Snapshot brechen. State-Transition:
// hero_pending -> layout_pending.
export async function selectHeroFromLibrary(
  db: Db,
  input: SelectHeroFromLibraryInput
): Promise<{ storage_url: string }> {
  const cur = await db.query<{ status: CampaignState; brand_id: string }>(
    `SELECT status, brand_id FROM campaigns WHERE id = $1`,
    [input.campaignId]
  );
  if (cur.rows.length === 0) {
    throw new Error(`Campaign ${input.campaignId} not found`);
  }

  const lib = await db.query<{
    storage_url: string;
    brand_id: string;
  }>(
    `SELECT storage_url, brand_id FROM hero_library WHERE id = $1`,
    [input.libraryEntryId]
  );
  if (lib.rows.length === 0) {
    throw new Error(`Library entry ${input.libraryEntryId} not found`);
  }
  if (lib.rows[0].brand_id !== cur.rows[0].brand_id) {
    throw new Error(
      `Library entry brand does not match campaign brand (cross-brand select not allowed)`
    );
  }

  const nextState = transitionGate(cur.rows[0].status, "HERO_SELECTED");
  const storageUrl = lib.rows[0].storage_url;

  await db.query(`BEGIN`);
  try {
    await db.query(
      `INSERT INTO campaign_hero
         (campaign_id, storage_url, source, library_id, is_approved, approved_at)
         VALUES ($1, $2, 'library', $3, true, now())
         ON CONFLICT (campaign_id) DO UPDATE
           SET storage_url = EXCLUDED.storage_url,
               source = 'library',
               library_id = EXCLUDED.library_id,
               is_approved = true,
               approved_at = now(),
               updated_at = now()`,
      [input.campaignId, storageUrl, input.libraryEntryId]
    );
    await db.query(
      `UPDATE campaigns SET status = $2, updated_at = now() WHERE id = $1`,
      [input.campaignId, nextState]
    );
    await db.query(`COMMIT`);
  } catch (e) {
    await db.query(`ROLLBACK`);
    throw e;
  }

  return { storage_url: storageUrl };
}
