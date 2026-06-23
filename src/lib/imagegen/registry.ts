import type { ModelEntry } from "./types";

// Die EINZIGE Quelle, aus der das Frontend-Modell-Dropdown rendert. Neues Modell
// = ein Eintrag hier. `enabled` schaltet ein Modell frei (z.B. nach QA + Lizenz-
// Freigabe). V1: nur Bild aktiv; Seedance (Video) ist vorbereitet aber disabled
// (Video = Out-of-V1 laut CLAUDE.md).
//
// Modell-IDs vor Live-Schaltung auf fal.ai/explore/models verifizieren — sie
// aendern sich; genau dafuer ist `providerModelId` ein isolierter String.
export const MODELS: ModelEntry[] = [
  {
    id: "nano-banana-2",
    label: "Nano Banana 2",
    provider: "fal",
    providerModelId: "fal-ai/nano-banana-2",
    capability: "text-to-image",
    output: "image",
    supportsStyleRef: true, // Multi-Image-Referenz fuer Brand-Style-Lock
    costHint: "~$0.08/Bild",
    enabled: true,
  },
  {
    id: "imagen-4",
    label: "Imagen 4",
    provider: "fal",
    providerModelId: "fal-ai/imagen4/preview",
    capability: "text-to-image",
    output: "image",
    supportsStyleRef: false,
    fallbackId: "nano-banana-2",
    enabled: false, // erst nach QA freischalten
  },
  {
    id: "seedance-2-i2v",
    label: "Seedance 2.0 (Video, V2)",
    provider: "fal",
    providerModelId: "bytedance/seedance-2.0/image-to-video",
    capability: "image-to-video",
    output: "video",
    supportsStyleRef: false,
    enabled: false, // Video = Out-of-V1; nur Architektur-Vorbereitung
  },
];

// Was das Frontend-Dropdown rendert: nur aktivierte Modelle.
export function listEnabledModels(): ModelEntry[] {
  return MODELS.filter((m) => m.enabled);
}

export function findModel(id: string): ModelEntry | undefined {
  return MODELS.find((m) => m.id === id);
}

// Default-Modell fuer Server-fixierte Generierung (Marketer waehlt vorerst nicht):
// das erste aktivierte Bild-Modell.
export function defaultImageModel(): ModelEntry {
  const m = MODELS.find((x) => x.enabled && x.output === "image");
  if (!m) throw new Error("Kein aktiviertes Bild-Modell in der Registry");
  return m;
}
