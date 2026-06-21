// @vitest-environment node

import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./fixtures/createTestDb";
import { findVoiceVariant } from "../queries/brand-voice";
import { ZIELGRUPPEN } from "../../schemas/brief";

// Der Dev-/Bootstrap-Seed (supabase/seeds/dev.sql) muss der Brand eine
// markengerechte Tone-of-Voice fuer JEDEN V1-Kampagnentyp geben. Fuer V1.1
// heisst das: pro Zielgruppe eine NEUTRALE 'standard'-Stimme (kein Flash-
// Dringlichkeitston), damit Live-Standard-Kampagnen nicht still auf einen
// preis-getriebenen Default zurueckfallen.
describe("dev seed — brand voice coverage", () => {
  let db: PGlite | undefined;

  afterEach(async () => {
    if (db) await db.close();
    db = undefined;
  });

  async function seededDb(): Promise<PGlite> {
    const instance = await createTestDb();
    const seedSql = fs.readFileSync(
      path.join(process.cwd(), "supabase", "seeds", "dev.sql"),
      "utf-8"
    );
    await instance.exec(seedSql);
    return instance;
  }

  it("provides a neutral 'standard' voice variant for every zielgruppe", async () => {
    db = await seededDb();
    const wingoId = (
      await db.query<{ id: string }>(`SELECT id FROM brands WHERE slug = 'wingo'`)
    ).rows[0].id;

    for (const zielgruppe of ZIELGRUPPEN) {
      const voice = await findVoiceVariant(db, wingoId, "standard", zielgruppe);
      // Eine standard-SPEZIFISCHE Zelle, nicht der NULL-NULL-Default-Fallback.
      expect(
        voice.kampagne_art,
        `standard voice for zielgruppe=${zielgruppe}`
      ).toBe("standard");
      expect(voice.zielgruppe).toBe(zielgruppe);
      expect(voice.is_default).toBe(false);
    }
  });
});
