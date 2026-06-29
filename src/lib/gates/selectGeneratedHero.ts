import type { Db } from "../db/types";
import { transitionGate, type CampaignState } from "../state/transitionGate";

export interface SelectGeneratedHeroInput {
  campaignId: string;
  storageUrl: string;
}

// Gate-2-Action: User waehlt einen generierten AI-Kandidaten als Hero.
// Speichert source='ai' + Snapshot der storage_url (der bereits in Storage
// persistierte Kandidat). State-Transition: hero_pending -> layout_pending.
// AI-Geschwister von selectHeroFromLibrary.
export async function selectGeneratedHero(
  db: Db,
  input: SelectGeneratedHeroInput
): Promise<{ storage_url: string }> {
  // Der Kandidat muss bereits in Storage persistiert sein — leere URL = ungueltig.
  if (input.storageUrl.trim().length === 0) {
    throw new Error("selectGeneratedHero: storageUrl ist leer (empty)");
  }

  const cur = await db.query<{ status: CampaignState }>(
    `SELECT status FROM campaigns WHERE id = $1`,
    [input.campaignId]
  );
  if (cur.rows.length === 0) {
    throw new Error(`Campaign ${input.campaignId} not found`);
  }

  const nextState = transitionGate(cur.rows[0].status, "HERO_SELECTED");
  const storageUrl = input.storageUrl;

  await db.query(`BEGIN`);
  try {
    await db.query(
      `INSERT INTO campaign_hero
         (campaign_id, storage_url, source, is_approved, approved_at)
         VALUES ($1, $2, 'ai', true, now())
         ON CONFLICT (campaign_id) DO UPDATE
           SET storage_url = EXCLUDED.storage_url,
               source = 'ai',
               is_approved = true,
               approved_at = now(),
               updated_at = now()`,
      [input.campaignId, storageUrl]
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
