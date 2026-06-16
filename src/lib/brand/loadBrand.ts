import type { Db } from "../db/types";
import { getActiveBrand, type Brand } from "../db/queries/brands";
import { getV1Formats, type FormatSpec } from "../db/queries/format-specs";
import {
  getDefaultVoice,
  type BrandVoice,
} from "../db/queries/brand-voice";
import {
  getAllDisclaimers,
  type Disclaimer,
} from "../db/queries/disclaimers";
import { loadBrandTokens, type BrandTokens } from "./loadTokens";
import { loadGlossar, type Glossar } from "./loadGlossar";

export interface BrandConfig {
  brand: Brand;
  tokens: BrandTokens;
  glossar: Glossar;
  defaultVoice: BrandVoice;
  disclaimers: Disclaimer[];
  formats: FormatSpec[];
}

export interface LoadBrandOptions {
  baseDir?: string;
}

// Deep Module: kleine Interface-Oberflaeche, vereint alle Brand-Daten die
// Phase 1+ braucht, in einem Aufruf. Fail-Fast wenn eines der Fundamente fehlt.
export async function loadBrand(
  db: Db,
  slug: string,
  opts: LoadBrandOptions = {}
): Promise<BrandConfig> {
  const brand = await getActiveBrand(db, slug);
  if (!brand) {
    throw new Error(`Brand "${slug}" not found or inactive`);
  }

  const tokens = loadBrandTokens(slug, { baseDir: opts.baseDir });
  const glossar = loadGlossar(slug, { baseDir: opts.baseDir });

  const [defaultVoice, disclaimers, formats] = await Promise.all([
    getDefaultVoice(db, brand.id),
    getAllDisclaimers(db, brand.id),
    getV1Formats(db),
  ]);

  return { brand, tokens, glossar, defaultVoice, disclaimers, formats };
}
