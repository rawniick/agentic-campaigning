// @vitest-environment node

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import AdmZip from "adm-zip";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createInMemoryStorage } from "../../storage/inMemoryStorage";
import { createCampaign } from "../../db/queries/campaigns";
import { createAsset, recordFailedAsset } from "../../db/queries/assets";
import { exportCampaignZip, EmptyExportError } from "../exportCampaignZip";
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

  // Partial-success: ein fehlgeschlagenes Asset (status='failed', storage_url=NULL)
  // darf den ZIP-Download nicht crashen — es wird stumm uebersprungen, die
  // erfolgreichen Assets landen trotzdem im Archiv.
  it("skips failed (storage_url=NULL) rows and still zips the rendered assets", async () => {
    const storage = createInMemoryStorage();

    const okBytes = Buffer.from("HALFPAGE-OK");
    const { url } = await storage.upload("hp-ok.png", okBytes, "image/png");
    await createAsset(db, {
      campaign_id: campaignId,
      format_id: halfpageFormatId,
      language: "de",
      storage_url: url,
      file_size_bytes: okBytes.length,
      mime_type: "image/png",
    });

    // Fehlgeschlagenes Asset ohne URL — fetch(null) wuerde ohne Filter den
    // ganzen Promise.all-Export crashen.
    await recordFailedAsset(db, {
      campaign_id: campaignId,
      format_id: billboardFormatId,
      language: "de",
      error: "render boom",
    });

    const zipBuf = await exportCampaignZip(db, campaignId, async (u) => {
      const key = u.replace("memory://", "");
      const bytes = storage.read(key);
      if (!bytes) throw new Error(`Missing: ${key}`);
      return bytes;
    });

    const archive = new AdmZip(zipBuf);
    const names = archive.getEntries().map((e) => e.entryName).sort();
    expect(names).toEqual(["wingo_flashsale_halfpage_300x600_de.png"]);
  });

  // KO-Gate: brand-nicht-konforme Assets (conformity_pass=false) duerfen NICHT in
  // den finalen Export — z.B. mit Platzhalter-Logo gerenderte Assets.
  it("excludes brand-non-conform assets (conformity_pass=false) from the final ZIP", async () => {
    const storage = createInMemoryStorage();

    const okBytes = Buffer.from("HP-OK");
    const badBytes = Buffer.from("BB-NON-CONFORM");
    const okUrl = (await storage.upload("hp-ok.png", okBytes, "image/png")).url;
    const badUrl = (await storage.upload("bb-bad.png", badBytes, "image/png")).url;

    await createAsset(db, {
      campaign_id: campaignId,
      format_id: halfpageFormatId,
      language: "de",
      storage_url: okUrl,
      file_size_bytes: okBytes.length,
      mime_type: "image/png",
      conformity_pass: true,
    });
    await createAsset(db, {
      campaign_id: campaignId,
      format_id: billboardFormatId,
      language: "de",
      storage_url: badUrl,
      file_size_bytes: badBytes.length,
      mime_type: "image/png",
      conformity_pass: false,
    });

    const zipBuf = await exportCampaignZip(db, campaignId, async (u) => {
      const key = u.replace("memory://", "");
      const bytes = storage.read(key);
      if (!bytes) throw new Error(`Missing: ${key}`);
      return bytes;
    });

    const archive = new AdmZip(zipBuf);
    const names = archive.getEntries().map((e) => e.entryName).sort();
    expect(names).toEqual(["wingo_flashsale_halfpage_300x600_de.png"]);
  });

  // Statt eines verwirrenden leeren 200-ZIP: ein distinkter Fehler, wenn alles
  // brand-nicht-konform (oder noch nichts gerendert) ist.
  it("throws EmptyExportError when no deliverable assets exist (e.g. all non-conform)", async () => {
    const storage = createInMemoryStorage();
    const { url } = await storage.upload("bad.png", Buffer.from("X"), "image/png");
    await createAsset(db, {
      campaign_id: campaignId,
      format_id: halfpageFormatId,
      language: "de",
      storage_url: url,
      file_size_bytes: 1,
      mime_type: "image/png",
      conformity_pass: false,
    });

    await expect(
      exportCampaignZip(db, campaignId, async () => Buffer.from("X"))
    ).rejects.toThrow(EmptyExportError);
  });
});
