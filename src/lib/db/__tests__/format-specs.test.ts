import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./fixtures/createTestDb";
import { getV1Formats } from "../queries/format-specs";

describe("getV1Formats", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("returns exactly the 11 V1 format specs from the seed", async () => {
    const formats = await getV1Formats(db);

    expect(formats).toHaveLength(11);

    const codes = formats.map((f) => f.code).sort();
    expect(codes).toEqual([
      "dv360_billboard",
      "dv360_halfpage",
      "dv360_rectangle",
      "dv360_ricchi",
      "dv360_wideboard_xl",
      "google_discovery",
      "google_pmax_static",
      "google_sea_ad_ext",
      "meta_image",
      "reddit_link_image",
      "tiktok_image",
    ]);
  });

  it("exposes width and height for every V1 format", async () => {
    const formats = await getV1Formats(db);
    for (const f of formats) {
      expect(f.width).toBeGreaterThan(0);
      expect(f.height).toBeGreaterThan(0);
    }
  });
});
