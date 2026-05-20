import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./fixtures/createTestDb";
import { writeAudit, getAuditForCampaign } from "../queries/audit";
import { createCampaign } from "../queries/campaigns";
import type { Brief } from "../../schemas/brief";

const BRIEF: Brief = {
  kampagne: {
    name: "T",
    art: "flash_sale",
    datum_von: "2026-05-22",
    datum_bis: "2026-05-28",
    produkt_kategorie: "mobile",
  },
  produkt: { name: "P", preis_promo: 19.95, preis_suffix: "/Mt." },
  strategie: { input: "x" },
  vermarktung: { hauptbotschaft: "x", zielgruppe: "sozial", zielgebiet: "deutschschweiz" },
  assets_kanaele: { channel_kategorien: [], format_codes: ["dv360_halfpage"] },
  sonstiges: {},
};

describe("audit_log", () => {
  let db: PGlite;
  let wingoId: string;
  let campaignId: string;

  beforeAll(async () => {
    db = await createTestDb();
    wingoId = (
      await db.query<{ id: string }>(
        `SELECT id FROM brands WHERE slug = 'wingo'`
      )
    ).rows[0].id;
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM audit_log`);
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);
    const c = await createCampaign(db, { brand_id: wingoId, brief: BRIEF });
    campaignId = c.id;
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("writes an event and reads it back via getAuditForCampaign", async () => {
    await writeAudit(db, {
      campaignId,
      event: "GATE_TRANSITION",
      payload: { from: "copy_pending", to: "hero_pending" },
    });

    const log = await getAuditForCampaign(db, campaignId);
    expect(log).toHaveLength(1);
    expect(log[0].event).toBe("GATE_TRANSITION");
    expect(log[0].payload).toEqual({ from: "copy_pending", to: "hero_pending" });
    expect(log[0].ts).toBeDefined();
  });

  it("orders events chronologically (oldest first)", async () => {
    await writeAudit(db, { campaignId, event: "E1", payload: {} });
    await writeAudit(db, { campaignId, event: "E2", payload: {} });
    await writeAudit(db, { campaignId, event: "E3", payload: {} });

    const log = await getAuditForCampaign(db, campaignId);
    expect(log.map((e) => e.event)).toEqual(["E1", "E2", "E3"]);
  });
});
