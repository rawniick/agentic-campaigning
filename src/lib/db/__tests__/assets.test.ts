import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./fixtures/createTestDb";
import { createAsset, getAssetById, getAssetsForCampaign } from "../queries/assets";
import { createCampaign } from "../queries/campaigns";
import type { Brief } from "../../schemas/brief";

const VALID_BRIEF: Brief = {
  kampagne: {
    name: "Test Kampagne",
    art: "flash_sale",
    datum_von: "2026-05-22",
    datum_bis: "2026-05-28",
    produkt_kategorie: "mobile",
  },
  produkt: {
    name: "Wingo Mobile Swiss",
    preis_promo: 19.95,
    preis_suffix: "/Mt.",
  },
  strategie: { input: "test" },
  vermarktung: {
    hauptbotschaft: "test",
    zielgruppe: "sozial",
    zielgebiet: "deutschschweiz",
  },
  assets_kanaele: { channel_kategorien: [], format_codes: ["dv360_halfpage"] },
  sonstiges: {},
};

describe("assets CRUD", () => {
  let db: PGlite;
  let wingoId: string;
  let campaignId: string;
  let formatId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const r = await db.query<{ id: string }>(
      `SELECT id FROM brands WHERE slug = 'wingo'`
    );
    wingoId = r.rows[0].id;
    const fmt = await db.query<{ id: string }>(
      `SELECT id FROM format_specs WHERE code = 'dv360_halfpage'`
    );
    formatId = fmt.rows[0].id;
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM assets`);
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);
    const c = await createCampaign(db, { brand_id: wingoId, brief: VALID_BRIEF });
    campaignId = c.id;
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("creates an asset row with the storage URL and metadata", async () => {
    const asset = await createAsset(db, {
      campaign_id: campaignId,
      format_id: formatId,
      language: "de",
      storage_url: "memory://wingo/test/asset.png",
      file_size_bytes: 12345,
      mime_type: "image/png",
    });

    expect(asset.id).toBeDefined();
    expect(asset.storage_url).toBe("memory://wingo/test/asset.png");

    const fetched = await getAssetById(db, asset.id);
    expect(fetched?.language).toBe("de");
    expect(fetched?.file_size_bytes).toBe(12345);
  });

  it("lists all assets for a campaign", async () => {
    await createAsset(db, {
      campaign_id: campaignId,
      format_id: formatId,
      language: "de",
      storage_url: "memory://a.png",
    });
    await createAsset(db, {
      campaign_id: campaignId,
      format_id: formatId,
      language: "fr",
      storage_url: "memory://b.png",
    });

    const all = await getAssetsForCampaign(db, campaignId);
    expect(all).toHaveLength(2);
    expect(all.map((a) => a.language).sort()).toEqual(["de", "fr"]);
  });
});
