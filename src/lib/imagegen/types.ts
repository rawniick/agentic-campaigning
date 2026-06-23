// Provider-agnostische Contracts fuer AI-Bild-(spaeter Video-)Generierung.
// Analog zum bewaehrten EmbeddingProvider-Muster (src/lib/embedding/types.ts):
// schmales Interface, austauschbare Implementierungen (fal/replicate/mock).
// Alle Typen hier, damit registry + Provider zyklenfrei darauf zugreifen.

// Modalitaet/Eingabe-Tag. V1 nutzt nur die Image-Varianten; Video ist vorbereitet
// (Out-of-V1 laut CLAUDE.md) damit ein Seedance-Eintrag spaeter nur Config ist.
export type Capability =
  | "text-to-image"
  | "image-to-image"
  | "text-to-video"
  | "image-to-video";

// EIN Registry-Eintrag = EIN Frontend-Dropdown-Eintrag. Neues Modell = ein Eintrag,
// KEIN neuer Code (solange die Capability existiert). `providerModelId` ist der
// einzige austauschbare String (z.B. "fal-ai/nano-banana-2").
export interface ModelEntry {
  id: string; // stabile interne ID, z.B. "nano-banana-2"
  label: string; // Dropdown-Anzeige, z.B. "Nano Banana 2"
  provider: "fal" | "replicate";
  providerModelId: string; // anbieter-spezifischer Endpoint-String
  capability: Capability;
  output: "image" | "video";
  supportsStyleRef: boolean; // Brand-Style-Lock via Referenzbild moeglich?
  costHint?: string; // fuers UI, z.B. "~$0.08/Bild"
  fallbackId?: string; // Cross-Modell-Fallback bei Provider-Fehler
  enabled: boolean; // Feature-Flag: im Dropdown sichtbar/waehlbar?
}

export interface GenerateInput {
  prompt: string;
  // Brand-Anchor (Style-Reference) aus brand-assets/wingo/samples/* oder Top-K
  // hero_library-Treffern. Erzwingt Stilkonsistenz wo das Modell es unterstuetzt.
  styleReferenceUrls?: string[];
  n?: number; // Anzahl Kandidaten, Default 3 (Gate-2)
  aspectRatio?: string;
  modelParams?: Record<string, unknown>; // pro Modell durchgereicht
}

export interface GeneratedImage {
  url: string;
  bytes?: Buffer;
  contentType: string;
  seed?: number;
}

// Transport-Schicht: EIN Adapter pro Provider (nicht pro Modell). Die Engine/Gate
// kennt nur dieses Interface — Provider-Wechsel ist Config, kein Rewrite.
export interface ImageProvider {
  readonly name: string;
  generate(model: ModelEntry, input: GenerateInput): Promise<GeneratedImage[]>;
}
