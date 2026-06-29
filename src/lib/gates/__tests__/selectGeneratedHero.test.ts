import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createCampaign } from "../../db/queries/campaigns";
import { selectGeneratedHero } from "../selectGeneratedHero";
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

describe("selectGeneratedHero (Gate 2 — AI-Kandidat)", () => {
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

  it("upserts campaign_hero with source='ai', approved, snapshotting storage_url", async () => {
    const url = "memory://gen/wingo/cand-1.png";
    const result = await selectGeneratedHero(db, { campaignId, storageUrl: url });

    expect(result.storage_url).toBe(url);

    const hero = await db.query<{
      storage_url: string;
      source: string;
      is_approved: boolean;
      approved_at: string | null;
    }>(
      `SELECT storage_url, source, is_approved, approved_at
         FROM campaign_hero WHERE campaign_id = $1`,
      [campaignId]
    );
    expect(hero.rows[0].source).toBe("ai");
    expect(hero.rows[0].storage_url).toBe(url);
    expect(hero.rows[0].is_approved).toBe(true);
    expect(hero.rows[0].approved_at).not.toBeNull();
  });

  it("transitions campaign status hero_pending -> layout_pending", async () => {
    await selectGeneratedHero(db, {
      campaignId,
      storageUrl: "memory://gen/wingo/cand-2.png",
    });

    const status = await db.query<{ status: string }>(
      `SELECT status FROM campaigns WHERE id = $1`,
      [campaignId]
    );
    expect(status.rows[0].status).toBe("layout_pending");
  });

  it("re-picking updates the existing row (ON CONFLICT) — single row, source stays 'ai', storage_url updated", async () => {
    // Erste Auswahl
    await selectGeneratedHero(db, {
      campaignId,
      storageUrl: "memory://gen/wingo/cand-first.png",
    });

    // Status zuruecksetzen, damit eine zweite Auswahl erneut die Transition passiert
    await db.query(`UPDATE campaigns SET status = 'hero_pending' WHERE id = $1`, [
      campaignId,
    ]);

    // Zweite Auswahl mit anderer URL -> muss dieselbe Zeile aktualisieren
    await selectGeneratedHero(db, {
      campaignId,
      storageUrl: "memory://gen/wingo/cand-second.png",
    });

    const hero = await db.query<{
      storage_url: string;
      source: string;
    }>(
      `SELECT storage_url, source FROM campaign_hero WHERE campaign_id = $1`,
      [campaignId]
    );
    expect(hero.rows.length).toBe(1);
    expect(hero.rows[0].storage_url).toBe("memory://gen/wingo/cand-second.png");
    expect(hero.rows[0].source).toBe("ai");
  });

  it("rejects when campaign is not in hero_pending", async () => {
    await db.query(`UPDATE campaigns SET status = 'done' WHERE id = $1`, [
      campaignId,
    ]);

    await expect(
      selectGeneratedHero(db, {
        campaignId,
        storageUrl: "memory://gen/wingo/cand-x.png",
      })
    ).rejects.toThrow(/Invalid transition/);
  });

  it("rejects empty storageUrl", async () => {
    await expect(
      selectGeneratedHero(db, { campaignId, storageUrl: "" })
    ).rejects.toThrow(/leer|empty/i);
  });
});
