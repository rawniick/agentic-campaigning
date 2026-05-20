import type { Db } from "../types";

export interface BrandVoice {
  id: string;
  brand_id: string;
  kampagne_art: string | null;
  zielgruppe: string | null;
  tov_md: string;
  is_default: boolean;
}

export async function getDefaultVoice(
  db: Db,
  brandId: string
): Promise<BrandVoice> {
  const result = await db.query<BrandVoice>(
    `SELECT id, brand_id, kampagne_art, zielgruppe, tov_md, is_default
       FROM brand_voice_variants
      WHERE brand_id = $1 AND is_default = true
      LIMIT 1`,
    [brandId]
  );
  const voice = result.rows[0];
  if (!voice) {
    throw new Error(`No default brand voice set for brand ${brandId}`);
  }
  return voice;
}

// Liefert die spezifische Variante fuer (art, zielgruppe), sonst den Brand-Default.
// is_default-Rows haben kampagne_art = NULL und zielgruppe = NULL.
// Wir sortieren so, dass spezifische Treffer Vorrang vor dem Default haben.
export async function findVoiceVariant(
  db: Db,
  brandId: string,
  kampagneArt: string,
  zielgruppe: string
): Promise<BrandVoice> {
  const result = await db.query<BrandVoice>(
    `SELECT id, brand_id, kampagne_art, zielgruppe, tov_md, is_default
       FROM brand_voice_variants
      WHERE brand_id = $1
        AND (
          (kampagne_art = $2 AND zielgruppe = $3)
          OR is_default = true
        )
      ORDER BY is_default ASC
      LIMIT 1`,
    [brandId, kampagneArt, zielgruppe]
  );
  const voice = result.rows[0];
  if (!voice) {
    throw new Error(
      `No brand voice variant found for brand ${brandId}: neither specific (${kampagneArt}, ${zielgruppe}) nor default exists. Seed at least one is_default=true row.`
    );
  }
  return voice;
}
