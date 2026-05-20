import type { Db } from "../db/types";
import { transitionGate, type CampaignState } from "../state/transitionGate";

export interface ApproveCopyInput {
  campaignId: string;
  headlineIndex: number;
}

// Gate-1-Action: User waehlt eine der generierten Headlines und gibt Copy frei.
// State-Transition: copy_pending -> hero_pending (oder Fehler).
export async function approveCopy(db: Db, input: ApproveCopyInput): Promise<void> {
  const { campaignId, headlineIndex } = input;

  // Aktuellen State + Anzahl Headlines lesen
  const cur = await db.query<{ status: CampaignState; headlines_len: number }>(
    `SELECT c.status, COALESCE(array_length(cc.headlines, 1), 0)::int AS headlines_len
       FROM campaigns c
       LEFT JOIN campaign_copy cc ON cc.campaign_id = c.id AND cc.language = 'de'
      WHERE c.id = $1`,
    [campaignId]
  );
  if (cur.rows.length === 0) {
    throw new Error(`Campaign ${campaignId} not found`);
  }
  const { status, headlines_len } = cur.rows[0];

  if (headlineIndex < 0 || headlineIndex >= headlines_len) {
    throw new Error(
      `headline index ${headlineIndex} out of range (0..${headlines_len - 1})`
    );
  }

  // throws bei nicht erlaubter Transition
  const nextState = transitionGate(status, "COPY_APPROVED");

  await db.query(`BEGIN`);
  try {
    await db.query(
      `UPDATE campaign_copy
          SET is_approved = true,
              selected_headline_idx = $2,
              approved_at = now()
        WHERE campaign_id = $1 AND language = 'de'`,
      [campaignId, headlineIndex]
    );
    await db.query(`UPDATE campaigns SET status = $2, updated_at = now() WHERE id = $1`, [
      campaignId,
      nextState,
    ]);
    await db.query(`COMMIT`);
  } catch (e) {
    await db.query(`ROLLBACK`);
    throw e;
  }
}
