// @vitest-environment node

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import AdmZip from "adm-zip";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createInMemoryStorage } from "../../storage/inMemoryStorage";
import { createCampaign } from "../../db/queries/campaigns";
import { createAsset } from "../../db/queries/assets";
import { exportCampaignZip } from "../exportCampaignZip";
import type { Brief } from "../../schemas/brief";

const BRIEF: Brief = {
  kampagne: {
    name: "Zip-Test",
    art: "flash_sale",
    datum_von: "2026-05-22",
    datum_bis: "2026-05-28",
    produkt_kategorie: "mobile",
  },
  produkt: { name: "P", preis_promo: 19.95, preis_suffix: "/Mt." },
  strategie: { input: "x" },
  vermarktung: { hauptbotschaft: "x", zielgruppe: "sozial", zielgebiet: "deutschschweiz" },
  assets_kanaele: { channel_kategorien: [], format_codes: [] },
  sonstiges: {},
};

describe("exportCampaignZip", () => {
  let db: PGlite;
  let wingoId: string;
  let halfpageFormatId: string;
  let billboardFormatId: string;
  let campaignId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const b = await db.query<{ id: string }>(
      `SELECT id FROM brands WHERE slug = 'wingo'`
    );
    wingoId = b.rows[0].id;
    const hf = await db.query<{ id: string }>(
      `SELECT id FROM format_specs WHERE code = 'dv360_halfpage'`
    );
    halfpageFormatId = hf.rows[0].id;
    const bb = await db.query<{ id: string }>(
      `SELECT id FROM format_specs WHERE code = 'dv360_billboard'`
    );
    billboardFormatId = bb.rows[0].id;
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM assets`);
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);
    const c = await createCampaign(db, { brand_id: wingoId, brief: BRIEF });
    campaignId = c.id;
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("bundles every asset with its format-conform filename", async () => {
    const storage = createInMemoryStorage();

    // Upload two assets to the in-memory store
    const halfpageBytes = Buffer.from("HALFPAGE-PNG-BYTES");
    const billboardBytes = Buffer.from("BILLBOARD-PNG-BYTES-LONGER");

    const hpUrl = (await storage.upload("wingo/halfpage-de.png", halfpageBytes, "image/png")).url;
    const bbUrl = (await storage.upload("wingo/billboard-de.png", billboardBytes, "image/png")).url;

    await createAsset(db, {
      campaign_id: campaignId,
      format_id: halfpageFormatId,
      language: "de",
      storage_url: hpUrl,
      file_size_bytes: halfpageBytes.length,
      mime_type: "image/png",
    });
    await createAsset(db, {
      campaign_id: campaignId,
      format_id: billboardFormatId,
      language: "de",
      storage_url: bbUrl,
      file_size_bytes: billboardBytes.length,
      mime_type: "image/png",
    });

    const zipBuf = await exportCampaignZip(db, campaignId, async (url) => {
      // simulated fetch: strip 'memory://' and read from store
      const key = url.replace("memory://", "");
      const bytes = storage.read(key);
      if (!bytes) throw new Error(`Missing in store: ${key}`);
      return bytes;
    });

    const archive = new AdmZip(zipBuf);
    const names = archive.getEntries().map((e) => e.entryName).sort();
    expect(names).toEqual([
      "wingo_flashsale_billboard_970x250_de.png",
      "wingo_flashsale_halfpage_300x600_de.png",
    ]);

    const hpEntry = archive.getEntry("wingo_flashsale_halfpage_300x600_de.png");
    expect(hpEntry?.getData().equals(halfpageBytes)).toBe(true);
  });

  it("groups one entry per (format x language) with the language suffix in the filename", async () => {
    const storage = createInMemoryStorage();
    const languages: Array<"de" | "fr" | "it" | "en"> = ["de", "fr", "it", "en"];

    for (const lang of languages) {
      const bytes = Buffer.from(`HALFPAGE-${lang.toUpperCase()}`);
      const { url } = await storage.upload(`hp-${lang}.png`, bytes, "image/png");
      await createAsset(db, {
        campaign_id: campaignId,
        format_id: halfpageFormatId,
        language: lang,
        storage_url: url,
        file_size_bytes: bytes.length,
        mime_type: "image/png",
      });
    }

    const zipBuf = await exportCampaignZip(db, campaignId, async (url) => {
      const key = url.replace("memory://", "");
      const bytes = storage.read(key);
      if (!bytes) throw new Error(`Missing: ${key}`);
      return bytes;
    });

    const archive = new AdmZip(zipBuf);
    const names = archive.getEntries().map((e) => e.entryName).sort();
    expect(names).toEqual([
      "wingo_flashsale_halfpage_300x600_de.png",
      "wingo_flashsale_halfpage_300x600_en.png",
      "wingo_flashsale_halfpage_300x600_fr.png",
      "wingo_flashsale_halfpage_300x600_it.png",
    ]);
  });
});
