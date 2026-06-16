import type { Db } from "../db/types";
import { transitionGate, type CampaignState } from "../state/transitionGate";
import {
  translateCampaignCopy,
  type TranslateLLMFn,
} from "../copy/translateCampaignCopy";

export interface ApproveCopyInput {
  campaignId: string;
  headlineIndex: number;
  // Wenn gesetzt: nach erfolgreichem Approval wird die DE-Copy via Batch-LLM-Call
  // in FR/IT/EN uebersetzt und als 3 weitere campaign_copy-Rows persistiert.
  translateOptions?: {
    passthroughTerms: string[];
    llm: TranslateLLMFn;
  };
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

  // Translation laeuft NACH dem Commit und ist BEST-EFFORT: ein LLM-Hiccup darf
  // das Gate-1-Approval nicht scheitern lassen — die DE-Copy bleibt approved.
  // Sicherheitsnetz ist runMultiplex (translate-if-missing), das fehlende
  // Zielsprachen vor dem Render nachzieht und sonst fail-loud abbricht.
  if (input.translateOptions) {
    try {
      await translateCampaignCopy(db, {
        campaignId,
        passthroughTerms: input.translateOptions.passthroughTerms,
        llm: input.translateOptions.llm,
      });
    } catch (e) {
      console.error(
        `[approveCopy] Gate-1-Uebersetzung fehlgeschlagen fuer ${campaignId}, ` +
          `wird im Multiplexer nachgezogen:`,
        e
      );
    }
  }
}
