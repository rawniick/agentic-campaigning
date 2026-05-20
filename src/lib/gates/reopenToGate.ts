import type { Db } from "../db/types";
import { transitionGate, type CampaignState, type GateEvent } from "../state/transitionGate";

export type ReopenTarget = "copy" | "hero" | "layout" | "final";

const EVENT_MAP: Record<ReopenTarget, GateEvent> = {
  copy: "REOPEN_TO_COPY",
  hero: "REOPEN_TO_HERO",
  layout: "REOPEN_TO_LAYOUT",
  final: "REOPEN_TO_FINAL",
};

// Hard-Reset Re-Open: schreibt Campaign-Status zurueck und LOESCHT alle
// Downstream-Daten. Bewusst destruktiv — User-Entscheidung von Phase 2 Grilling.
//   reopen 'copy'   -> wipe campaign_copy + campaign_hero + campaign_layout + assets
//   reopen 'hero'   -> wipe campaign_hero + campaign_layout + assets
//   reopen 'layout' -> wipe campaign_layout + assets
//   reopen 'final'  -> wipe assets
export async function reopenToGate(
  db: Db,
  campaignId: string,
  target: ReopenTarget
): Promise<void> {
  const event = EVENT_MAP[target];

  const cur = await db.query<{ status: CampaignState }>(
    `SELECT status FROM campaigns WHERE id = $1`,
    [campaignId]
  );
  if (cur.rows.length === 0) throw new Error(`Campaign ${campaignId} not found`);

  // throws bei Forward-Jump
  const nextState = transitionGate(cur.rows[0].status, event);

  await db.query(`BEGIN`);
  try {
    await db.query(`DELETE FROM assets WHERE campaign_id = $1`, [campaignId]);
    if (target !== "final") {
      await db.query(`DELETE FROM campaign_layout WHERE campaign_id = $1`, [campaignId]);
    }
    if (target === "copy" || target === "hero") {
      await db.query(`DELETE FROM campaign_hero WHERE campaign_id = $1`, [campaignId]);
    }
    if (target === "copy") {
      await db.query(`DELETE FROM campaign_copy WHERE campaign_id = $1`, [campaignId]);
    }

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
