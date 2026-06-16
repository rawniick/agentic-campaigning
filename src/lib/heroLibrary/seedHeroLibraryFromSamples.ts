import fs from "fs";
import path from "path";
import type { Db } from "../db/types";
import type { AssetStorage } from "../storage/types";
import { uploadToHeroLibrary } from "./uploadToHeroLibrary";
import { listHeroLibrary } from "../db/queries/hero-library";

// Dev-/Bootstrap-Seed: nimmt die von Nick in brand-assets/<slug>/samples/ abgelegten
// Wingo-Bildwelt-Bilder und legt sie als hero_library-Eintraege an, damit der Gate-2
// Library-Picker echte Bilder zeigt. Input-frei baubar (Fixtures), Ausfuehrung
// erfordert echte Sample-Dateien.

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export interface SeedHeroLibraryInput {
  brand_id: string;
  brandSlug: string;
  samplesDir: string;
}

export interface SeedHeroLibraryResult {
  seeded: number;
  skipped: number;
  failed: number;
}

// "sport-szene-01.png" → "sport szene 01" (Anzeigename, bewusst lossy).
function nameFromFilename(filename: string): string {
  return path
    .basename(filename, path.extname(filename))
    .replace(/[-_]+/g, " ")
    .trim();
}

// Spiegelt den safeName aus uploadToHeroLibrary. Idempotenz laeuft ueber den
// DATEINAMEN (nicht den lossy Anzeigenamen), damit zwei verschiedene Samples, die
// zufaellig denselben Anzeigenamen ergeben, nicht still verworfen werden.
function safeFilename(file: string): string {
  return file.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// uploadToHeroLibrary-Key = `${Date.now()}-${safeName}`; den Timestamp-Prefix
// abstreifen liefert den geseedeten Dateinamen zurueck.
function seededFilenameFromUrl(storageUrl: string): string {
  const base = storageUrl.split("/").pop() ?? "";
  return base.replace(/^\d+-/, "");
}

export async function seedHeroLibraryFromSamples(
  db: Db,
  storage: AssetStorage,
  input: SeedHeroLibraryInput
): Promise<SeedHeroLibraryResult> {
  if (!fs.existsSync(input.samplesDir)) return { seeded: 0, skipped: 0, failed: 0 };

  const files = fs
    .readdirSync(input.samplesDir)
    .filter((f) => MIME_BY_EXT[path.extname(f).toLowerCase()])
    .sort();

  // Idempotenz: was schon (per Dateiname) in der Library liegt, nicht erneut anlegen.
  const existing = new Set(
    (await listHeroLibrary(db, input.brand_id)).map((e) =>
      seededFilenameFromUrl(e.storage_url)
    )
  );

  let seeded = 0;
  let skipped = 0;
  let failed = 0;
  for (const file of files) {
    const key = safeFilename(file);
    if (existing.has(key)) {
      skipped++;
      continue;
    }
    // Per-Datei robust: eine kaputte/leere/nicht-lesbare Datei darf den Bootstrap
    // nicht abbrechen — sie wird gezaehlt, der Rest laeuft weiter.
    try {
      const bytes = fs.readFileSync(path.join(input.samplesDir, file));
      const contentType = MIME_BY_EXT[path.extname(file).toLowerCase()];
      await uploadToHeroLibrary(db, storage, {
        brand_id: input.brand_id,
        brandSlug: input.brandSlug,
        name: nameFromFilename(file),
        bytes,
        contentType,
        filename: file,
      });
      existing.add(key);
      seeded++;
    } catch (e) {
      console.warn(`[seedHeroLibrary] Sample ${file} uebersprungen:`, e);
      failed++;
    }
  }

  return { seeded, skipped, failed };
}
