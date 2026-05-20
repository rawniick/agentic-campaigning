// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../lib/db/__tests__/fixtures/createTestDb";
import { getV1Formats } from "../../lib/db/queries/format-specs";
import { listRegisteredFormatCodes } from "../wingo/registry";

// Contract: jeder V1-Format-Code aus format_specs muss ein Template haben.
// Wenn jemand ein neues V1-Format seeded ohne Template, schlaegt das hier.

describe("template registry contract", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("every V1 format_specs row has a registered flash_sale template", async () => {
    const v1Formats = await getV1Formats(db);
    const registered = new Set(listRegisteredFormatCodes("flash_sale"));

    const missing = v1Formats
      .map((f) => f.code)
      .filter((code) => !registered.has(code));

    expect(missing).toEqual([]);
  });

  it("covers exactly 11 V1 formats (V1 scope guard)", async () => {
    const v1Formats = await getV1Formats(db);
    expect(v1Formats).toHaveLength(11);
  });
});
