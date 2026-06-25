// @vitest-environment node

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import AdmZip from "adm-zip";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createInMemoryStorage } from "../../storage/inMemoryStorage";
import { createCampaign } from "../../db/queries/campaigns";
import { createAsset } from "../../db/queries/assets";
import { exportCampaignZip, EmptyExportError } from "../exportCampaignZip";
import type { Brief } from "../../schemas/brief";

const BRIEF: Brief = {
  kampagne: {
    name: "Qa-Gate-Test",
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

// Setzt die Vision-QA-Felder direkt (createAsset deckt sie nicht ab) — analog dazu
// wie runVisionQA sie in Production persistiert.
async function setVisionQA(
  db: PGlite,
  assetId: string,
  qa: { score: number; safezone: number }
): Promise<void> {
  const details = {
    score: qa.score,
    checks: {
      logo_bounds: 1,
      color_match: 1,
      safezone: qa.safezone,
      style_consistency: 1,
    },
  };
  await db.query(
    `UPDATE assets
        SET vision_qa_score = $2,
            vision_qa_details_json = $3::jsonb
      WHERE id = $1`,
    [assetId, qa.score, JSON.stringify(details)]
  );
}

const fetchFromStore = (storage: ReturnType<typeof createInMemoryStorage>) =>
  async (url: string): Promise<Buffer> => {
    const key = url.replace("memory://", "");
    const bytes = storage.read(key);
    if (!bytes) throw new Error(`Missing in store: ${key}`);
    return bytes;
  };

describe("exportCampaignZip — Vision-QA als Export-Gate", () => {
  let db: PGlite;
  let wingoId: string;
  let halfpageFormatId: string;
  let billboardFormatId: string;
  let campaignId: string;

  beforeAll(async () => {
    db = await createTestDb();
    wingoId = (
      await db.query<{ id: string }>(`SELECT id FROM brands WHERE slug = 'wingo'`)
    ).rows[0].id;
    halfpageFormatId = (
      await db.query<{ id: string }>(
        `SELECT id FROM format_specs WHERE code = 'dv360_halfpage'`
      )
    ).rows[0].id;
    billboardFormatId = (
      await db.query<{ id: string }>(
        `SELECT id FROM format_specs WHERE code = 'dv360_billboard'`
      )
    ).rows[0].id;
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM assets`);
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);
    campaignId = (await createCampaign(db, { brand_id: wingoId, brief: BRIEF })).id;
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  // Kern-Assertion: ein Asset mit klar verletztem Safezone-Score (< 0.6) faellt aus
  // dem Export; das gute Asset (Score >= 0.7, Safezone >= 0.6) bleibt drin.
  it("excludes an asset with a low safezone score, keeps the conform one", async () => {
    const storage = createInMemoryStorage();

    const goodBytes = Buffer.from("HP-GOOD");
    const badBytes = Buffer.from("BB-SAFEZONE-VIOLATION");
    const goodUrl = (await storage.upload("hp-good.png", goodBytes, "image/png")).url;
    const badUrl = (await storage.upload("bb-bad.png", badBytes, "image/png")).url;

    const good = await createAsset(db, {
      campaign_id: campaignId,
      format_id: halfpageFormatId,
      language: "de",
      storage_url: goodUrl,
      file_size_bytes: goodBytes.length,
      mime_type: "image/png",
    });
    const bad = await createAsset(db, {
      campaign_id: campaignId,
      format_id: billboardFormatId,
      language: "de",
      storage_url: badUrl,
      file_size_bytes: badBytes.length,
      mime_type: "image/png",
    });

    // Gutes Asset: Score deutlich ueber Schwelle, Safezone intakt.
    await setVisionQA(db, good.id, { score: 0.92, safezone: 0.95 });
    // Schlechtes Asset: Gesamt-Score okay, aber Logo-Safezone grob verletzt (< 0.6).
    await setVisionQA(db, bad.id, { score: 0.85, safezone: 0.3 });

    const zipBuf = await exportCampaignZip(db, campaignId, fetchFromStore(storage));

    const names = new AdmZip(zipBuf)
      .getEntries()
      .map((e) => e.entryName)
      .sort();
    expect(names).toEqual(["wingo_flashsale_halfpage_300x600_de.png"]);
  });

  // Niedriger Gesamt-Score (< 0.7) blockt ebenfalls, auch wenn die Safezone okay ist.
  it("excludes an asset whose overall vision-qa score is below 0.7", async () => {
    const storage = createInMemoryStorage();

    const goodBytes = Buffer.from("HP-GOOD");
    const lowBytes = Buffer.from("BB-LOW-SCORE");
    const goodUrl = (await storage.upload("hp-good.png", goodBytes, "image/png")).url;
    const lowUrl = (await storage.upload("bb-low.png", lowBytes, "image/png")).url;

    const good = await createAsset(db, {
      campaign_id: campaignId,
      format_id: halfpageFormatId,
      language: "de",
      storage_url: goodUrl,
      file_size_bytes: goodBytes.length,
      mime_type: "image/png",
    });
    const low = await createAsset(db, {
      campaign_id: campaignId,
      format_id: billboardFormatId,
      language: "de",
      storage_url: lowUrl,
      file_size_bytes: lowBytes.length,
      mime_type: "image/png",
    });

    await setVisionQA(db, good.id, { score: 0.92, safezone: 0.95 });
    await setVisionQA(db, low.id, { score: 0.4, safezone: 0.9 });

    const zipBuf = await exportCampaignZip(db, campaignId, fetchFromStore(storage));

    const names = new AdmZip(zipBuf)
      .getEntries()
      .map((e) => e.entryName)
      .sort();
    expect(names).toEqual(["wingo_flashsale_halfpage_300x600_de.png"]);
  });

  // NULL bleibt zugelassen: ein Asset, fuer das die QA nie lief, darf nicht still
  // aus dem Export fallen.
  it("includes an asset with no vision-qa result (NULL is allowed through)", async () => {
    const storage = createInMemoryStorage();

    const bytes = Buffer.from("HP-NO-QA");
    const url = (await storage.upload("hp-noqa.png", bytes, "image/png")).url;
    await createAsset(db, {
      campaign_id: campaignId,
      format_id: halfpageFormatId,
      language: "de",
      storage_url: url,
      file_size_bytes: bytes.length,
      mime_type: "image/png",
    });
    // Bewusst KEIN setVisionQA — vision_qa_score / _details_json bleiben NULL.

    const zipBuf = await exportCampaignZip(db, campaignId, fetchFromStore(storage));

    const names = new AdmZip(zipBuf).getEntries().map((e) => e.entryName);
    expect(names).toEqual(["wingo_flashsale_halfpage_300x600_de.png"]);
  });

  // Wenn ALLE Assets an der QA durchfallen, kein leeres ZIP, sondern ein distinkter
  // Fehler — der nun auch den QA-Grund nennt.
  it("throws EmptyExportError mentioning the QA reason when all assets fail QA", async () => {
    const storage = createInMemoryStorage();
    const url = (await storage.upload("bad.png", Buffer.from("X"), "image/png")).url;
    const asset = await createAsset(db, {
      campaign_id: campaignId,
      format_id: halfpageFormatId,
      language: "de",
      storage_url: url,
      file_size_bytes: 1,
      mime_type: "image/png",
    });
    await setVisionQA(db, asset.id, { score: 0.85, safezone: 0.2 });

    await expect(
      exportCampaignZip(db, campaignId, async () => Buffer.from("X"))
    ).rejects.toThrow(/Vision-QA/);
  });
});
