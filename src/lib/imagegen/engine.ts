import { findModel, defaultImageModel } from "./registry";
import type { ImageProvider, GenerateInput, GeneratedImage } from "./types";

export interface GenerateHeroOptions {
  modelId?: string; // ohne -> defaultImageModel() (server-fixiert)
  input: GenerateInput;
}

// Erzeugt N Hero-Kandidaten ueber den gewaehlten Provider/Modell. Fail-loud bei
// unbekanntem/deaktiviertem Modell. Cross-Modell-Fallback via model.fallbackId
// bei Provider-Fehler. Library-First selbst ist eine GATE-Concern (erst Library,
// dann "Generate New" eskaliert hierher) — die Engine ist der Generierungs-Schritt.
export async function generateHeroCandidates(
  provider: ImageProvider,
  opts: GenerateHeroOptions
): Promise<GeneratedImage[]> {
  const model = opts.modelId ? findModel(opts.modelId) : defaultImageModel();
  if (!model) throw new Error(`Unbekanntes Modell: ${opts.modelId}`);
  if (!model.enabled) throw new Error(`Modell ${model.id} ist nicht aktiviert`);

  try {
    return await provider.generate(model, opts.input);
  } catch (e) {
    if (model.fallbackId) {
      const fb = findModel(model.fallbackId);
      if (fb?.enabled) return provider.generate(fb, opts.input);
    }
    throw e;
  }
}
