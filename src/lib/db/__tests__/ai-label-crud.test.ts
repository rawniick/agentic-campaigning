import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./fixtures/createTestDb";
import {
  upsertAiLabelAsset,
  getAiLabelAsset,
} from "../queries/ai-label";

describe("ai_label_assets CRUD", () => {
  let db: PGlite;
  let wingoId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const r = await db.query<{ id: string }>(
      `SELECT id FROM brands WHERE slug = 'wingo'`
    );
    wingoId = r.rows[0].id;
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM ai_label_assets`);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("upserts a brand AI-label asset and reads it back", async () => {
    await upsertAiLabelAsset(db, {
      brand_id: wingoId,
      storage_url: "https://example.com/wingo-ai-label.svg",
      default_position: {
        anchor: "bottom-right",
        offset: { x: 8, y: 8 },
        size: { w: 50, h: 16 },
      },
    });

    const got = await getAiLabelAsset(db, wingoId);
    expect(got?.storage_url).toBe("https://example.com/wingo-ai-label.svg");
    expect(got?.default_position.anchor).toBe("bottom-right");
    expect(got?.default_position.offset).toEqual({ x: 8, y: 8 });
    expect(got?.default_position.size).toEqual({ w: 50, h: 16 });
  });
});
