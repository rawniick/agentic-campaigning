import fs from "fs";
import path from "path";
import { z } from "zod";

// Glossar = Translator-Passthrough-Quelle. Terms in passthrough_terms bleiben
// in JEDER Sprache 1:1 identisch (Wingo-Markennamen, "5G im Swisscom Netz" etc.).
// Unbekannte Felder (translation_overrides, forbidden_phrases, _meta) werden
// bewusst weggestrippt — V1 nutzt nur passthrough_terms.
const GlossarSchema = z.object({
  passthrough_terms: z.array(z.string()),
});

export type Glossar = z.infer<typeof GlossarSchema>;

export interface LoadGlossarOptions {
  baseDir?: string;
}

export function loadGlossar(
  slug: string,
  opts: LoadGlossarOptions = {}
): Glossar {
  const baseDir = opts.baseDir ?? path.join(process.cwd(), "brand-assets");
  const glossarPath = path.join(baseDir, slug, "glossar.json");
  const raw = fs.readFileSync(glossarPath, "utf-8");
  const json = JSON.parse(raw);
  return GlossarSchema.parse(json);
}
