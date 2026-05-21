import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { upsertAiLabelAsset } from "../../db/queries/ai-label";
import {
  updateAiLabelPosition,
  type FormatSpec,
} from "../../db/queries/format-specs";
import { resolveAiLabelConfig } from "../resolveAiLabelConfig";

const DEFAULT_POS = {
  anchor: "bottom-right" as const,
  offset: { x: 8, y: 8 },
  size: { w: 50, h: 16 },
};

const FORMAT_OVERRIDE = {
  anchor: "top-left" as const,
  offset: { x: 4, y: 4 },
  size: { w: 30, h: 10 },
};

async function getHalfpageSpec(db: PGlite): Promise<FormatSpec> {
  const r = await db.query<FormatSpec>(
    `SELECT * FROM format_specs WHERE code = 'dv360_halfpage'`
  );
  return r.rows[0];
}

describe("resolveAiLabelConfig", () => {
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
    await db.query(`UPDATE format_specs SET ai_label_position = NULL`);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("returns null when no AI-label asset is registered for the brand", async () => {
    const spec = await getHalfpageSpec(db);

    const got = await resolveAiLabelConfig(db, wingoId, spec);

    expect(got).toBeNull();
  });

  it("uses the brand default position when the format spec has no override", async () => {
    await upsertAiLabelAsset(db, {
      brand_id: wingoId,
      storage_url: "https://example.com/wingo-ai-label.svg",
      default_position: DEFAULT_POS,
    });
    const spec = await getHalfpageSpec(db);

    const got = await resolveAiLabelConfig(db, wingoId, spec);

    expect(got).not.toBeNull();
    expect(got!.src).toBe("https://example.com/wingo-ai-label.svg");
    expect(got!.position).toEqual(DEFAULT_POS);
  });

  it("uses the format-spec override when present", async () => {
    await upsertAiLabelAsset(db, {
      brand_id: wingoId,
      storage_url: "https://example.com/wingo-ai-label.svg",
      default_position: DEFAULT_POS,
    });
    const spec = await getHalfpageSpec(db);
    await updateAiLabelPosition(db, spec.id, FORMAT_OVERRIDE);
    const updatedSpec = { ...spec, ai_label_position: FORMAT_OVERRIDE };

    const got = await resolveAiLabelConfig(db, wingoId, updatedSpec);

    expect(got).not.toBeNull();
    expect(got!.position).toEqual(FORMAT_OVERRIDE);
  });
});
