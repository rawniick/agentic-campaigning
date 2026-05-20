import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./fixtures/createTestDb";
import { getActiveBrand } from "../queries/brands";

describe("getActiveBrand", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("returns the seeded Wingo brand by slug", async () => {
    const brand = await getActiveBrand(db, "wingo");

    expect(brand).not.toBeNull();
    expect(brand?.slug).toBe("wingo");
    expect(brand?.is_active).toBe(true);
  });
});
