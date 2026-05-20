import type { FormatSpec } from "../db/queries/format-specs";

export interface BuildAssetZipNameInput {
  brandSlug: string;
  campaignArt: string;
  format: FormatSpec;
  language: string;
}

// Schema: <brand>_<campaign_art_slug>_<bezeichnung_slug>_<W>x<H>_<lang>.png
// Bezeichnung wird kleingeschrieben und non-alphanumerisch -> '_'.
// Beispiel: 'Halfpage Ad'  ->  'halfpage_ad'
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// "Halfpage Ad" -> "halfpage" (Trailing "_ad" wird entfernt, weil redundant).
function slugifyBezeichnung(value: string): string {
  const s = slugify(value);
  return s.endsWith("_ad") ? s.slice(0, -3) : s;
}

export function buildAssetZipName(input: BuildAssetZipNameInput): string {
  const brand = slugify(input.brandSlug);
  const art = slugify(input.campaignArt).replace(/_/g, "");
  const bezeichnung = slugifyBezeichnung(input.format.format_bezeichnung);
  const { width, height } = input.format;
  const lang = input.language;
  return `${brand}_${art}_${bezeichnung}_${width}x${height}_${lang}.png`;
}
