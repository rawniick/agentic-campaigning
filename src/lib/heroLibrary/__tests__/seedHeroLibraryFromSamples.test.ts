// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createInMemoryStorage } from "../../storage/inMemoryStorage";
import { listHeroLibrary } from "../../db/queries/hero-library";
import { seedHeroLibraryFromSamples } from "../seedHeroLibraryFromSamples";

describe("seedHeroLibraryFromSamples", () => {
  let db: PGlite;
  let wingoId: string;
  const tmpDirs: string[] = [];

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

  afterEach(() => {
    while (tmpDirs.length) {
      fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
    }
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  // Schreibt die gegebenen Dateien in ein frisches temp-Verzeichnis.
  async function makeSamplesDir(
    files: Array<{ name: string; png?: boolean }>
  ): Promise<string> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wingo-samples-"));
    tmpDirs.push(dir);
    for (const f of files) {
      const bytes = f.png
        ? await sharp({
            create: { width: 32, height: 24, channels: 3, background: { r: 10, g: 20, b: 30 } },
          })
            .png()
            .toBuffer()
        : Buffer.alloc(0); // kaputtes/0-Byte-Sample
      fs.writeFileSync(path.join(dir, f.name), bytes);
    }
    return dir;
  }

  it("seeds one hero_library entry per image file in the samples dir", async () => {
    const storage = createInMemoryStorage();
    const dir = await makeSamplesDir([
      { name: "sport-szene-01.png", png: true },
      { name: "familie-mobil-01.png", png: true },
      { name: ".gitkeep" }, // Nicht-Bild → ignoriert
    ]);

    const res = await seedHeroLibraryFromSamples(db, storage, {
      brand_id: wingoId,
      brandSlug: "wingo",
      samplesDir: dir,
    });

    expect(res).toEqual({ seeded: 2, skipped: 0, failed: 0 });
    const lib = await listHeroLibrary(db, wingoId);
    expect(lib).toHaveLength(2);
    expect(lib.every((e) => e.storage_url.length > 0)).toBe(true);
  });

  it("is idempotent: re-running skips already-seeded samples (no duplicates)", async () => {
    const storage = createInMemoryStorage();
    const dir = await makeSamplesDir([
      { name: "sport-szene-01.png", png: true },
      { name: "familie-mobil-01.png", png: true },
    ]);
    const input = { brand_id: wingoId, brandSlug: "wingo", samplesDir: dir };

    await seedHeroLibraryFromSamples(db, storage, input);
    const res = await seedHeroLibraryFromSamples(db, storage, input);

    expect(res).toEqual({ seeded: 0, skipped: 2, failed: 0 });
    expect(await listHeroLibrary(db, wingoId)).toHaveLength(2);
  });

  it("does not silently drop distinct files that normalize to the same display name", async () => {
    const storage = createInMemoryStorage();
    // "sport-szene" und "sport_szene" ergeben denselben Anzeigenamen "sport szene",
    // sind aber verschiedene Dateien → beide muessen geseedet werden.
    const dir = await makeSamplesDir([
      { name: "sport-szene.png", png: true },
      { name: "sport_szene.jpg", png: true },
    ]);

    const res = await seedHeroLibraryFromSamples(db, storage, {
      brand_id: wingoId,
      brandSlug: "wingo",
      samplesDir: dir,
    });

    expect(res.seeded).toBe(2);
    expect(await listHeroLibrary(db, wingoId)).toHaveLength(2);
  });

  it("is robust to a broken sample: seeds the good ones and counts the bad", async () => {
    const storage = createInMemoryStorage();
    const dir = await makeSamplesDir([
      { name: "good-01.png", png: true },
      { name: "broken-empty.png" }, // 0 Byte → uploadToHeroLibrary wirft
    ]);

    const res = await seedHeroLibraryFromSamples(db, storage, {
      brand_id: wingoId,
      brandSlug: "wingo",
      samplesDir: dir,
    });

    expect(res.seeded).toBe(1);
    expect(res.failed).toBe(1);
    expect(await listHeroLibrary(db, wingoId)).toHaveLength(1);
  });
});
