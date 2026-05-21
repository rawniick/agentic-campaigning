import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createCampaign } from "../../db/queries/campaigns";
import { listHeroLibrary } from "../../db/queries/hero-library";
import { promoteHeroToLibrary } from "../promoteHeroToLibrary";
import type { Brief } from "../../schemas/brief";

const BRIEF: Brief = {
  kampagne: {
    name: "Test",
    art: "flash_sale",
    datum_von: "2026-07-01",
    datum_bis: "2026-07-15",
    produkt_kategorie: "mobile",
  },
  produkt: { name: "Wingo Mobile Swiss", preis_promo: 19.95, preis_suffix: "/Mt." },
  strategie: { input: "Sommer 5G" },
  vermarktung: {
    hauptbotschaft: "Schweizweit unbegrenzt",
    zielgruppe: "sozial",
    zielgebiet: "deutschschweiz",
  },
  assets_kanaele: { channel_kategorien: [], format_codes: ["dv360_halfpage"] },
  sonstiges: {},
};

describe("promoteHeroToLibrary", () => {
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
    await db.query(`DELETE FROM campaign_hero`);
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);
    await db.query(`DELETE FROM hero_library`);

    const c = await createCampaign(db, { brand_id: wingoId, brief: BRIEF });
    campaignId = c.id;
    await db.query(
      `UPDATE campaigns SET status = 'done' WHERE id = $1`,
      [campaignId]
    );
    await db.query(
      `INSERT INTO campaign_hero
         (campaign_id, storage_url, source, is_approved, approved_at)
         VALUES ($1, 'https://example.com/promoted.jpg', 'upload', true, now())`,
      [campaignId]
    );
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("creates a hero_library entry pointing at the campaign hero storage_url", async () => {
    const entry = await promoteHeroToLibrary(db, {
      campaignId,
      name: "Promoted Sommer Hero",
      categories: ["mobile"],
      lifestyles: ["sport"],
      seasons: ["sommer"],
    });

    expect(entry.id).toMatch(/[0-9a-f-]{36}/);
    expect(entry.brand_id).toBe(wingoId);
    expect(entry.name).toBe("Promoted Sommer Hero");
    expect(entry.storage_url).toBe("https://example.com/promoted.jpg");
    expect(entry.categories).toEqual(["mobile"]);
    expect(entry.lifestyles).toEqual(["sport"]);
    expect(entry.seasons).toEqual(["sommer"]);

    const all = await listHeroLibrary(db, wingoId);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(entry.id);
  });

  it("rejects when campaign has no hero row", async () => {
    await db.query(`DELETE FROM campaign_hero WHERE campaign_id = $1`, [
      campaignId,
    ]);

    await expect(
      promoteHeroToLibrary(db, {
        campaignId,
        name: "No hero here",
      })
    ).rejects.toThrow(/no hero|not found/i);

    const all = await listHeroLibrary(db, wingoId);
    expect(all).toHaveLength(0);
  });

  it("rejects re-promoting a hero that already came from the library", async () => {
    await db.query(
      `UPDATE campaign_hero SET source = 'library' WHERE campaign_id = $1`,
      [campaignId]
    );

    await expect(
      promoteHeroToLibrary(db, {
        campaignId,
        name: "Already from library",
      })
    ).rejects.toThrow(/already.*library|duplicate/i);

    const all = await listHeroLibrary(db, wingoId);
    expect(all).toHaveLength(0);
  });
});
