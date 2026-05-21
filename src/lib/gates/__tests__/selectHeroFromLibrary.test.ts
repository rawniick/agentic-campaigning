import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createCampaign } from "../../db/queries/campaigns";
import { createHeroLibraryEntry } from "../../db/queries/hero-library";
import { selectHeroFromLibrary } from "../selectHeroFromLibrary";
import type { Brief } from "../../schemas/brief";

const BRIEF: Brief = {
  kampagne: {
    name: "Test",
    art: "flash_sale",
    datum_von: "2026-05-22",
    datum_bis: "2026-05-28",
    produkt_kategorie: "mobile",
  },
  produkt: { name: "Wingo Mobile Swiss", preis_promo: 19.95, preis_suffix: "/Mt." },
  strategie: { input: "x" },
  vermarktung: {
    hauptbotschaft: "x",
    zielgruppe: "sozial",
    zielgebiet: "deutschschweiz",
  },
  assets_kanaele: { channel_kategorien: [], format_codes: ["dv360_halfpage"] },
  sonstiges: {},
};

describe("selectHeroFromLibrary (Gate 2)", () => {
  let db: PGlite;
  let wingoId: string;
  let campaignId: string;
  let libraryEntryId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const r = await db.query<{ id: string }>(
      `SELECT id FROM brands WHERE slug = 'wingo'`
    );
    wingoId = r.rows[0].id;
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM campaign_hero`);
    await db.query(`DELETE FROM campaign_copy`);
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);
    await db.query(`DELETE FROM hero_library`);

    const c = await createCampaign(db, { brand_id: wingoId, brief: BRIEF });
    campaignId = c.id;
    await db.query(`UPDATE campaigns SET status = 'hero_pending' WHERE id = $1`, [
      campaignId,
    ]);

    const lib = await createHeroLibraryEntry(db, {
      brand_id: wingoId,
      name: "Library Pick A",
      storage_url: "https://example.com/lib-a.jpg",
      categories: ["mobile"],
    });
    libraryEntryId = lib.id;
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("links library entry to campaign_hero and transitions to layout_pending", async () => {
    await selectHeroFromLibrary(db, {
      campaignId,
      libraryEntryId,
    });

    const status = await db.query<{ status: string }>(
      `SELECT status FROM campaigns WHERE id = $1`,
      [campaignId]
    );
    expect(status.rows[0].status).toBe("layout_pending");

    const hero = await db.query<{
      storage_url: string;
      source: string;
      library_id: string | null;
      is_approved: boolean;
    }>(
      `SELECT storage_url, source, library_id, is_approved
         FROM campaign_hero WHERE campaign_id = $1`,
      [campaignId]
    );
    expect(hero.rows[0].source).toBe("library");
    expect(hero.rows[0].storage_url).toBe("https://example.com/lib-a.jpg");
    expect(hero.rows[0].library_id).toBe(libraryEntryId);
    expect(hero.rows[0].is_approved).toBe(true);
  });

  it("rejects if library entry does not exist", async () => {
    await expect(
      selectHeroFromLibrary(db, {
        campaignId,
        libraryEntryId: "00000000-0000-0000-0000-000000000000",
      })
    ).rejects.toThrow(/library entry/i);
  });

  it("rejects if campaign is not in hero_pending", async () => {
    await db.query(`UPDATE campaigns SET status = 'done' WHERE id = $1`, [
      campaignId,
    ]);

    await expect(
      selectHeroFromLibrary(db, { campaignId, libraryEntryId })
    ).rejects.toThrow(/Invalid transition/);
  });

  it("rejects if library entry belongs to a different brand", async () => {
    const r = await db.query<{ id: string }>(
      `INSERT INTO brands (slug, name) VALUES ('other_brand', 'Other')
         RETURNING id`
    );
    const otherBrandId = r.rows[0].id;
    try {
      const otherEntry = await createHeroLibraryEntry(db, {
        brand_id: otherBrandId,
        name: "Other Brand Hero",
        storage_url: "https://example.com/other.jpg",
      });

      await expect(
        selectHeroFromLibrary(db, {
          campaignId,
          libraryEntryId: otherEntry.id,
        })
      ).rejects.toThrow(/brand/i);
    } finally {
      await db.query(`DELETE FROM hero_library WHERE brand_id = $1`, [
        otherBrandId,
      ]);
      await db.query(`DELETE FROM brands WHERE id = $1`, [otherBrandId]);
    }
  });
});
