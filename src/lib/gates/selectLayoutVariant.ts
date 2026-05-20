import type { Db } from "../db/types";
import { transitionGate, type CampaignState } from "../state/transitionGate";

// Erlaubte Layout-Varianten je Master-Format. V1 = Flash Sale Halfpage.
// Brand-Team waechst spaeter (Phase 3+) zusaetzliche Varianten in den jeweiligen
// Format-Templates, hier wird nur die Liste gepflegt.
const ALLOWED_VARIANTS: Record<string, readonly string[]> = {
  dv360_halfpage: ["price_top", "price_bottom"] as const,
};

export interface SelectLayoutVariantInput {
  campaignId: string;
  variant: string;
  masterFormat: string;
}

// Gate-3-Action: Layout-Variante waehlen.
// State-Transition: layout_pending -> final_pending.
export async function selectLayoutVariant(
  db: Db,
  input: SelectLayoutVariantInput
): Promise<void> {
  const allowed = ALLOWED_VARIANTS[input.masterFormat];
  if (!allowed) {
    throw new Error(
      `Unknown master format ${input.masterFormat} — no variants registered`
    );
  }
  if (!allowed.includes(input.variant)) {
    throw new Error(
      `Unknown variant ${input.variant} for ${input.masterFormat}. Allowed: ${allowed.join(", ")}`
    );
  }

  const cur = await db.query<{ status: CampaignState }>(
    `SELECT status FROM campaigns WHERE id = $1`,
    [input.campaignId]
  );
  if (cur.rows.length === 0) {
    throw new Error(`Campaign ${input.campaignId} not found`);
  }
  const nextState = transitionGate(cur.rows[0].status, "LAYOUT_APPROVED");

  await db.query(`BEGIN`);
  try {
    await db.query(
      `INSERT INTO campaign_layout
         (campaign_id, master_format, variant, is_approved, approved_at)
         VALUES ($1, $2, $3, true, now())
         ON CONFLICT (campaign_id) DO UPDATE
           SET master_format = EXCLUDED.master_format,
               variant = EXCLUDED.variant,
               is_approved = true,
               approved_at = now(),
               updated_at = now()`,
      [input.campaignId, input.masterFormat, input.variant]
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
}
