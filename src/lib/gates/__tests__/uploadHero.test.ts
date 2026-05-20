import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createCampaign } from "../../db/queries/campaigns";
import { createInMemoryStorage } from "../../storage/inMemoryStorage";
import { uploadHero } from "../uploadHero";
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
  vermarktung: { hauptbotschaft: "x", zielgruppe: "sozial", zielgebiet: "deutschschweiz" },
  assets_kanaele: { channel_kategorien: [], format_codes: ["dv360_halfpage"] },
  sonstiges: {},
};

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

describe("uploadHero (Gate 2)", () => {
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
    await db.query(`DELETE FROM campaign_copy`);
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);

    const c = await createCampaign(db, { brand_id: wingoId, brief: BRIEF });
    campaignId = c.id;
    await db.query(`UPDATE campaigns SET status = 'hero_pending' WHERE id = $1`, [
      campaignId,
    ]);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("uploads bytes, persists campaign_hero, and transitions to layout_pending", async () => {
    const storage = createInMemoryStorage();

    await uploadHero(db, storage, {
      campaignId,
      brandSlug: "wingo",
      bytes: JPEG_MAGIC,
      contentType: "image/jpeg",
      filename: "hero.jpg",
    });

    const status = await db.query<{ status: string }>(
      `SELECT status FROM campaigns WHERE id = $1`,
      [campaignId]
    );
    expect(status.rows[0].status).toBe("layout_pending");

    const hero = await db.query<{
      storage_url: string;
      mime_type: string;
      is_approved: boolean;
    }>(
      `SELECT storage_url, mime_type, is_approved FROM campaign_hero WHERE campaign_id = $1`,
      [campaignId]
    );
    expect(hero.rows[0].storage_url).toContain("memory://");
    expect(hero.rows[0].mime_type).toBe("image/jpeg");
    expect(hero.rows[0].is_approved).toBe(true);

    const storageKey = hero.rows[0].storage_url.replace("memory://", "");
    expect(storage.has(storageKey)).toBe(true);
  });

  it("rejects if campaign is not in hero_pending", async () => {
    await db.query(`UPDATE campaigns SET status = 'done' WHERE id = $1`, [campaignId]);
    const storage = createInMemoryStorage();

    await expect(
      uploadHero(db, storage, {
        campaignId,
        brandSlug: "wingo",
        bytes: JPEG_MAGIC,
        contentType: "image/jpeg",
        filename: "hero.jpg",
      })
    ).rejects.toThrow(/Invalid transition/);
  });

  it("rejects empty bytes", async () => {
    const storage = createInMemoryStorage();

    await expect(
      uploadHero(db, storage, {
        campaignId,
        brandSlug: "wingo",
        bytes: Buffer.alloc(0),
        contentType: "image/jpeg",
        filename: "hero.jpg",
      })
    ).rejects.toThrow(/empty/i);
  });
});
