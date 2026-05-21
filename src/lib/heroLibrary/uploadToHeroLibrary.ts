import type { Db } from "../db/types";
import type { AssetStorage } from "../storage/types";
import {
  createHeroLibraryEntry,
  type HeroLibraryEntry,
} from "../db/queries/hero-library";

export interface UploadToHeroLibraryInput {
  brand_id: string;
  brandSlug: string;
  name: string;
  bytes: Buffer;
  contentType: string;
  filename: string;
  categories?: string[];
  lifestyles?: string[];
  seasons?: string[];
}

// Admin-Action: legt eine neue Hero-Library-Zeile an inkl. Storage-Upload.
// Storage-Keys liegen unter `hero-library/<brandSlug>/...` damit V1.1 die
// separate Bucket-Trennung (Phase 5 Plan) bei Bedarf nachholen kann.
export async function uploadToHeroLibrary(
  db: Db,
  storage: AssetStorage,
  input: UploadToHeroLibraryInput
): Promise<HeroLibraryEntry> {
  if (input.bytes.length === 0) {
    throw new Error("Hero-library upload: bytes are empty");
  }

  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `hero-library/${input.brandSlug}/${Date.now()}-${safeName}`;
  const { url } = await storage.upload(key, input.bytes, input.contentType);

  return createHeroLibraryEntry(db, {
    brand_id: input.brand_id,
    name: input.name,
    storage_url: url,
    categories: input.categories,
    lifestyles: input.lifestyles,
    seasons: input.seasons,
  });
}
