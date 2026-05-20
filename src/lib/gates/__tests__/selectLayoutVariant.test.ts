import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createCampaign } from "../../db/queries/campaigns";
import { selectLayoutVariant } from "../selectLayoutVariant";
import type { Brief } from "../../schemas/brief";

const BRIEF: Brief = {
  kampagne: {
    name: "T",
    art: "flash_sale",
    datum_von: "2026-05-22",
    datum_bis: "2026-05-28",
    produkt_kategorie: "mobile",
  },
  produkt: { name: "P", preis_promo: 19.95, preis_suffix: "/Mt." },
  strategie: { input: "x" },
  vermarktung: { hauptbotschaft: "x", zielgruppe: "sozial", zielgebiet: "deutschschweiz" },
  assets_kanaele: { channel_kategorien: [], format_codes: ["dv360_halfpage"] },
  sonstiges: {},
};

describe("selectLayoutVariant (Gate 3)", () => {
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
    await db.query(`DELETE FROM campaign_layout`);
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);
    const c = await createCampaign(db, { brand_id: wingoId, brief: BRIEF });
    campaignId = c.id;
    await db.query(
      `UPDATE campaigns SET status = 'layout_pending' WHERE id = $1`,
      [campaignId]
    );
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("persists the chosen variant and transitions to final_pending", async () => {
    await selectLayoutVariant(db, {
      campaignId,
      variant: "price_top",
      masterFormat: "dv360_halfpage",
    });

    const status = await db.query<{ status: string }>(
      `SELECT status FROM campaigns WHERE id = $1`,
      [campaignId]
    );
    expect(status.rows[0].status).toBe("final_pending");

    const layout = await db.query<{
      variant: string;
      master_format: string;
      is_approved: boolean;
    }>(
      `SELECT variant, master_format, is_approved FROM campaign_layout WHERE campaign_id = $1`,
      [campaignId]
    );
    expect(layout.rows[0].variant).toBe("price_top");
    expect(layout.rows[0].master_format).toBe("dv360_halfpage");
    expect(layout.rows[0].is_approved).toBe(true);
  });

  it("rejects an unknown variant for FlashSaleHalfpage", async () => {
    await expect(
      selectLayoutVariant(db, {
        campaignId,
        variant: "rainbow_chaos",
        masterFormat: "dv360_halfpage",
      })
    ).rejects.toThrow(/variant/i);
  });

  it("rejects if not in layout_pending state", async () => {
    await db.query(`UPDATE campaigns SET status = 'done' WHERE id = $1`, [campaignId]);
    await expect(
      selectLayoutVariant(db, {
        campaignId,
        variant: "price_top",
        masterFormat: "dv360_halfpage",
      })
    ).rejects.toThrow(/Invalid transition/);
  });
});
