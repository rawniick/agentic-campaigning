import type { EmbeddingProvider } from "./types";

// Test-only Provider: liefert nur Vektoren fuer vorab geseedete Texte und wirft
// sonst. Absicht: Test-Setups muessen die genauen Embedding-Inputs deklarieren,
// damit unerwartete Aufrufe nicht in stillen Defaults verschwinden.
export function createMockEmbeddingProvider(
  seed: Record<string, number[]> = {}
): EmbeddingProvider {
  return {
    async embed(text: string): Promise<number[]> {
      if (!(text in seed)) {
        throw new Error(`Mock embed: no seed for "${text}"`);
      }
      return seed[text];
    },
  };
}
