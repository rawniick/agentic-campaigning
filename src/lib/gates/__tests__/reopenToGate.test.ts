import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createCampaign } from "../../db/queries/campaigns";
import { reopenToGate } from "../reopenToGate";
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

describe("reopenToGate (Hard-Reset)", () => {
  let db: PGlite;
  let wingoId: string;
  let formatId: string;
  let campaignId: string;

  async function seedFullyDoneCampaign() {
    await db.query(`DELETE FROM assets`);
    await db.query(`DELETE FROM campaign_layout`);
    await db.query(`DELETE FROM campaign_hero`);
    await db.query(`DELETE FROM campaign_copy`);
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);

    const c = await createCampaign(db, { brand_id: wingoId, brief: BRIEF });
    campaignId = c.id;
    await db.query(`UPDATE campaigns SET status = 'done' WHERE id = $1`, [campaignId]);

    await db.query(
      `INSERT INTO campaign_copy (campaign_id, language, headlines, subline, cta_label, disclaimer_ids, is_approved)
         VALUES ($1, 'de', ARRAY['H'], 'S', 'C', ARRAY[]::uuid[], true)`,
      [campaignId]
    );
    await db.query(
      `INSERT INTO campaign_hero (campaign_id, storage_url, is_approved)
         VALUES ($1, 'memory://h', true)`,
      [campaignId]
    );
    await db.query(
      `INSERT INTO campaign_layout (campaign_id, master_format, variant, is_approved)
         VALUES ($1, 'dv360_halfpage', 'price_top', true)`,
      [campaignId]
    );
    await db.query(
      `INSERT INTO assets (campaign_id, format_id, language, storage_url)
         VALUES ($1, $2, 'de', 'memory://asset.png')`,
      [campaignId, formatId]
    );
  }

  async function countAll() {
    const rows = await Promise.all([
      db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM campaign_copy WHERE campaign_id = $1`,
        [campaignId]
      ),
      db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM campaign_hero WHERE campaign_id = $1`,
        [campaignId]
      ),
      db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM campaign_layout WHERE campaign_id = $1`,
        [campaignId]
      ),
      db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM assets WHERE campaign_id = $1`,
        [campaignId]
      ),
    ]);
    return {
      copy: rows[0].rows[0].count,
      hero: rows[1].rows[0].count,
      layout: rows[2].rows[0].count,
      assets: rows[3].rows[0].count,
    };
  }

  beforeAll(async () => {
    db = await createTestDb();
    const r = await db.query<{ id: string }>(
      `SELECT id FROM brands WHERE slug = 'wingo'`
    );
    wingoId = r.rows[0].id;
    const f = await db.query<{ id: string }>(
      `SELECT id FROM format_specs WHERE code = 'dv360_halfpage'`
    );
    formatId = f.rows[0].id;
  });

  beforeEach(async () => {
    await seedFullyDoneCampaign();
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("re-open to copy from done: state=copy_pending, ALL downstream wiped", async () => {
    await reopenToGate(db, campaignId, "copy");

    const status = (
      await db.query<{ status: string }>(
        `SELECT status FROM campaigns WHERE id = $1`,
        [campaignId]
      )
    ).rows[0].status;
    expect(status).toBe("copy_pending");

    const counts = await countAll();
    expect(counts).toEqual({ copy: 0, hero: 0, layout: 0, assets: 0 });
  });

  it("re-open to hero: copy KEPT, hero/layout/assets wiped", async () => {
    await reopenToGate(db, campaignId, "hero");

    expect(
      (await db.query<{ status: string }>(`SELECT status FROM campaigns WHERE id = $1`, [campaignId])).rows[0].status
    ).toBe("hero_pending");

    const counts = await countAll();
    expect(counts).toEqual({ copy: 1, hero: 0, layout: 0, assets: 0 });
  });

  it("re-open to layout: copy + hero KEPT, layout/assets wiped", async () => {
    await reopenToGate(db, campaignId, "layout");

    expect(
      (await db.query<{ status: string }>(`SELECT status FROM campaigns WHERE id = $1`, [campaignId])).rows[0].status
    ).toBe("layout_pending");

    const counts = await countAll();
    expect(counts).toEqual({ copy: 1, hero: 1, layout: 0, assets: 0 });
  });

  it("re-open to final: copy + hero + layout KEPT, only assets wiped", async () => {
    await reopenToGate(db, campaignId, "final");

    expect(
      (await db.query<{ status: string }>(`SELECT status FROM campaigns WHERE id = $1`, [campaignId])).rows[0].status
    ).toBe("final_pending");

    const counts = await countAll();
    expect(counts).toEqual({ copy: 1, hero: 1, layout: 1, assets: 0 });
  });

  it("rejects forward-jumps (e.g., re-open to final from copy_pending)", async () => {
    // Setze auf copy_pending zurueck
    await db.query(`UPDATE campaigns SET status = 'copy_pending' WHERE id = $1`, [campaignId]);
    await db.query(`DELETE FROM assets WHERE campaign_id = $1`, [campaignId]);
    await db.query(`DELETE FROM campaign_layout WHERE campaign_id = $1`, [campaignId]);
    await db.query(`DELETE FROM campaign_hero WHERE campaign_id = $1`, [campaignId]);

    await expect(reopenToGate(db, campaignId, "final")).rejects.toThrow(
      /Invalid transition/
    );
  });
});
