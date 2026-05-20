// @vitest-environment node

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createAsset } from "../../db/queries/assets";
import { createCampaign } from "../../db/queries/campaigns";
import { runVisionQA } from "../runVisionQA";
import type { Brief } from "../../schemas/brief";
import type { VisionQAClient, VisionQAResult } from "../runVisionQA";

const BRIEF: Brief = {
  kampagne: {
    name: "QA-Test",
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

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("runVisionQA", () => {
  let db: PGlite;
  let wingoId: string;
  let halfpageFormatId: string;
  let campaignId: string;
  let assetId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const b = await db.query<{ id: string }>(
      `SELECT id FROM brands WHERE slug = 'wingo'`
    );
    wingoId = b.rows[0].id;
    const f = await db.query<{ id: string }>(
      `SELECT id FROM format_specs WHERE code = 'dv360_halfpage'`
    );
    halfpageFormatId = f.rows[0].id;
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM assets`);
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);
    const c = await createCampaign(db, { brand_id: wingoId, brief: BRIEF });
    campaignId = c.id;
    const a = await createAsset(db, {
      campaign_id: campaignId,
      format_id: halfpageFormatId,
      language: "de",
      storage_url: "memory://test.png",
      file_size_bytes: 64,
      mime_type: "image/png",
    });
    assetId = a.id;
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("persists score and check details from the Vision client onto the asset row", async () => {
    const result: VisionQAResult = {
      score: 0.85,
      checks: {
        logo_bounds: 0.9,
        color_match: 0.95,
        safezone: 0.8,
        style_consistency: 0.75,
      },
      notes: "Looks good.",
    };
    const client: VisionQAClient = {
      analyze: vi.fn().mockResolvedValue(result),
    };

    await runVisionQA(db, client, {
      assetId,
      imageBytes: PNG_SIG,
      imageMimeType: "image/png",
      brandPrimaryHex: "#E61E2A",
      formatCode: "dv360_halfpage",
    });

    const r = await db.query<{
      vision_qa_score: string | null;
      vision_qa_details_json: Record<string, unknown> | null;
    }>(
      `SELECT vision_qa_score, vision_qa_details_json FROM assets WHERE id = $1`,
      [assetId]
    );
    expect(Number(r.rows[0].vision_qa_score)).toBeCloseTo(0.85, 3);
    expect(r.rows[0].vision_qa_details_json).toMatchObject({
      checks: {
        logo_bounds: 0.9,
        color_match: 0.95,
        safezone: 0.8,
        style_consistency: 0.75,
      },
    });
  });
});
