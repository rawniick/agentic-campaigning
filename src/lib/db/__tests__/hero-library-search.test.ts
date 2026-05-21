import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./fixtures/createTestDb";
import {
  createHeroLibraryEntry,
  searchHeroLibrary,
} from "../queries/hero-library";

describe("searchHeroLibrary (cosine)", () => {
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
    await db.query(`DELETE FROM hero_library`);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("ranks entries by cosine similarity to query embedding", async () => {
    const identical = await createHeroLibraryEntry(db, {
      brand_id: wingoId,
      name: "Identical",
      storage_url: "https://example.com/a.jpg",
      embedding: [1, 0, 0],
    });
    await createHeroLibraryEntry(db, {
      brand_id: wingoId,
      name: "Orthogonal",
      storage_url: "https://example.com/b.jpg",
      embedding: [0, 1, 0],
    });
    const diagonal = await createHeroLibraryEntry(db, {
      brand_id: wingoId,
      name: "Diagonal 45deg",
      storage_url: "https://example.com/c.jpg",
      embedding: [0.7071, 0.7071, 0],
    });

    const results = await searchHeroLibrary(db, {
      brandId: wingoId,
      queryEmbedding: [1, 0, 0],
      k: 2,
    });

    expect(results).toHaveLength(2);
    expect(results[0].entry.id).toBe(identical.id);
    expect(results[1].entry.id).toBe(diagonal.id);
    expect(results[0].similarity).toBeCloseTo(1, 4);
    expect(results[1].similarity).toBeCloseTo(0.7071, 3);
  });

  it("excludes entries with NULL embedding from results", async () => {
    await createHeroLibraryEntry(db, {
      brand_id: wingoId,
      name: "Has embedding",
      storage_url: "https://example.com/a.jpg",
      embedding: [1, 0, 0],
    });
    await createHeroLibraryEntry(db, {
      brand_id: wingoId,
      name: "No embedding (uploaded raw)",
      storage_url: "https://example.com/b.jpg",
    });

    const results = await searchHeroLibrary(db, {
      brandId: wingoId,
      queryEmbedding: [1, 0, 0],
      k: 5,
    });

    expect(results).toHaveLength(1);
    expect(results[0].entry.name).toBe("Has embedding");
  });
});
