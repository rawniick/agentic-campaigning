import type {
  ImageProvider,
  ModelEntry,
  GenerateInput,
  GeneratedImage,
} from "./types";

// Deterministischer Mock fuer Tests + lokale Entwicklung ohne fal-Key.
// `failModelIds` simuliert Provider-Fehler (fuer Fallback-/Fehler-Tests).
export function createMockImageProvider(
  opts: { failModelIds?: string[] } = {}
): ImageProvider {
  return {
    name: "mock",
    async generate(
      model: ModelEntry,
      input: GenerateInput
    ): Promise<GeneratedImage[]> {
      if (opts.failModelIds?.includes(model.id)) {
        throw new Error(`mock: Modell ${model.id} simuliert Fehler`);
      }
      const n = input.n ?? 3;
      return Array.from({ length: n }, (_, i) => ({
        url: `mock://${model.id}/${i}.png`,
        contentType: "image/png",
        seed: i,
      }));
    },
  };
}
