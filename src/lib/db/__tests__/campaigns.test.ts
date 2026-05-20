import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./fixtures/createTestDb";
import { createCampaign, getCampaignById } from "../queries/campaigns";
import type { Brief } from "../../schemas/brief";

const VALID_BRIEF: Brief = {
  kampagne: {
    name: "Wingo Mobile Swiss — Flash Sale",
    art: "flash_sale",
    datum_von: "2026-05-22",
    datum_bis: "2026-05-28",
    produkt_kategorie: "mobile",
  },
  produkt: {
    name: "Wingo Mobile Swiss",
    preis_promo: 19.95,
    preis_standard: 29.95,
    preis_suffix: "/Mt.",
  },
  strategie: { input: "Marktreaktion auf Salt-Preissenkung" },
  vermarktung: {
    hauptbotschaft: "Schweizer Netz, halber Preis.",
    zielgruppe: "sozial",
    zielgebiet: "deutschschweiz",
  },
  assets_kanaele: {
    channel_kategorien: ["Display Standard"],
    format_codes: ["dv360_halfpage"],
  },
  sonstiges: {},
};

describe("createCampaign", () => {
  let db: PGlite;
  let wingoId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const res = await db.query<{ id: string }>(
      `SELECT id FROM brands WHERE slug = 'wingo'`
    );
    wingoId = res.rows[0].id;
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("persists the campaign and the full brief, status 'created'", async () => {
    const campaign = await createCampaign(db, {
      brand_id: wingoId,
      brief: VALID_BRIEF,
    });

    expect(campaign.id).toBeDefined();
    expect(campaign.status).toBe("created");
    expect(campaign.art).toBe("flash_sale");
    expect(campaign.price_promo).toBe(19.95);

    const reread = await getCampaignById(db, campaign.id);
    expect(reread?.brief.produkt.name).toBe("Wingo Mobile Swiss");
    expect(reread?.brief.vermarktung.hauptbotschaft).toBe(
      "Schweizer Netz, halber Preis."
    );
  });
});
