// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./fixtures/createTestDb";
import {
  getFormatSpecById,
  updateAiLabelPosition,
  type AiLabelPosition,
} from "../queries/format-specs";

describe("format-specs admin queries", () => {
  let db: PGlite;
  let halfpageId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const r = await db.query<{ id: string }>(
      `SELECT id FROM format_specs WHERE code = 'dv360_halfpage'`
    );
    halfpageId = r.rows[0].id;
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("updateAiLabelPosition writes the JSON blob and getFormatSpecById reads it back", async () => {
    const position: AiLabelPosition = {
      anchor: "top-right",
      offset: { x: 12, y: 12 },
      size: { w: 48, h: 48 },
    };

    await updateAiLabelPosition(db, halfpageId, position);

    const spec = await getFormatSpecById(db, halfpageId);
    expect(spec?.ai_label_position).toEqual(position);
  });

  it("updateAiLabelPosition rejects an unknown anchor value", async () => {
    await expect(
      updateAiLabelPosition(db, halfpageId, {
        // @ts-expect-error — exercising runtime guard
        anchor: "middle",
        offset: { x: 0, y: 0 },
        size: { w: 1, h: 1 },
      })
    ).rejects.toThrow();
  });

  it("updateAiLabelPosition can clear the position by passing null", async () => {
    await updateAiLabelPosition(db, halfpageId, null);
    const spec = await getFormatSpecById(db, halfpageId);
    expect(spec?.ai_label_position).toBeNull();
  });
});
