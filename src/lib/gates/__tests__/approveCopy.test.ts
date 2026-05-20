import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createCampaign } from "../../db/queries/campaigns";
import { approveCopy } from "../approveCopy";
import type { Brief } from "../../schemas/brief";

const VALID_BRIEF: Brief = {
  kampagne: {
    name: "Test",
    art: "flash_sale",
    datum_von: "2026-05-22",
    datum_bis: "2026-05-28",
    produkt_kategorie: "mobile",
  },
  produkt: { name: "Wingo Mobile Swiss", preis_promo: 19.95, preis_suffix: "/Mt." },
  strategie: { input: "x" },
  vermarktung: { hauptbotschaft: "x", zielgruppe: "sozial", zielgebiet: "deutschschweiz" },
  assets_kanaele: { channel_kategorien: [], format_codes: ["dv360_halfpage"] },
  sonstiges: {},
};

describe("approveCopy (Gate 1)", () => {
  let db: PGlite;
  let wingoId: string;
  let campaignId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const r = await db.query<{ id: string }>(
      `SELECT id FROM brands WHERE slug = 'wingo'`
    );
    wingoId = r.rows[0].id;
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM campaign_copy`);
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);

    const c = await createCampaign(db, { brand_id: wingoId, brief: VALID_BRIEF });
    campaignId = c.id;

    // simulate copy_pending state after submitBrief
    await db.query(`UPDATE campaigns SET status = 'copy_pending' WHERE id = $1`, [campaignId]);
    await db.query(
      `INSERT INTO campaign_copy
         (campaign_id, language, headlines, subline, cta_label, disclaimer_ids)
         VALUES ($1, 'de', ARRAY['H1','H2','H3'], 'Sub', 'CTA', ARRAY[]::uuid[])`,
      [campaignId]
    );
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("approves the picked headline and transitions to hero_pending", async () => {
    await approveCopy(db, { campaignId, headlineIndex: 1 });

    const c = await db.query<{ status: string }>(
      `SELECT status FROM campaigns WHERE id = $1`,
      [campaignId]
    );
    expect(c.rows[0].status).toBe("hero_pending");

    const copy = await db.query<{
      is_approved: boolean;
      selected_headline_idx: number | null;
    }>(
      `SELECT is_approved, selected_headline_idx FROM campaign_copy WHERE campaign_id = $1`,
      [campaignId]
    );
    expect(copy.rows[0].is_approved).toBe(true);
    expect(copy.rows[0].selected_headline_idx).toBe(1);
  });

  it("rejects if campaign is not in copy_pending state", async () => {
    await db.query(`UPDATE campaigns SET status = 'done' WHERE id = $1`, [campaignId]);

    await expect(
      approveCopy(db, { campaignId, headlineIndex: 0 })
    ).rejects.toThrow(/Invalid transition/);
  });

  it("rejects an out-of-range headline index", async () => {
    await expect(
      approveCopy(db, { campaignId, headlineIndex: 99 })
    ).rejects.toThrow(/headline index/i);
    await expect(
      approveCopy(db, { campaignId, headlineIndex: -1 })
    ).rejects.toThrow();
  });
});
