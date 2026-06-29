import type { AssetStorage } from "../storage/types";
import type { ImageProvider } from "../imagegen/types";
import { generateHeroCandidates } from "../imagegen/engine";

export interface GenerateHeroForGateInput {
  campaignId: string;
  brandSlug: string;
  prompt: string;
  // Komponenten-Uploads + Library-Referenzen — werden als styleReferenceUrls
  // an nano-banana durchgereicht (Multi-Image-Fusion / Brand-Style-Lock).
  referenceUrls?: string[];
  n?: number; // Default 3 Kandidaten (Gate 2)
  modelId?: string;
}

export interface PersistedHeroCandidate {
  storage_url: string;
  contentType: string;
  seed?: number;
}

// Default-Download fuer fal-URLs (fluechtig): Bytes ziehen, in Buffer wandeln.
async function defaultFetchBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Hero-Download fehlgeschlagen (${res.status}): ${url}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// Gate-2-Action "Bild generieren": N Kandidaten via nano-banana erzeugen, jeden
// herunterladen und dauerhaft in Storage persistieren (fal-URLs verfallen). Es
// wird NOCH NICHT campaign_hero geschrieben — die Auswahl ist ein spaeterer Schritt.
export async function generateHeroCandidatesForGate(
  provider: ImageProvider,
  storage: AssetStorage,
  input: GenerateHeroForGateInput,
  fetchBytes: (url: string) => Promise<Buffer> = defaultFetchBytes
): Promise<PersistedHeroCandidate[]> {
  // Prompt ist Pflicht — leer/whitespace ist ein Bedienfehler, kein leeres Bild.
  if (input.prompt.trim().length === 0) {
    throw new Error("Hero-Generierung: prompt darf nicht leer sein");
  }

  const n = input.n ?? 3;

  const images = await generateHeroCandidates(provider, {
    modelId: input.modelId,
    input: {
      prompt: input.prompt,
      styleReferenceUrls: input.referenceUrls,
      n,
    },
  });

  const persisted: PersistedHeroCandidate[] = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    // Bytes des Kandidaten ziehen (sofern Provider nicht schon welche lieferte).
    const bytes = img.bytes ?? (await fetchBytes(img.url));
    // Deterministischer Key (Index, NICHT Date.now()) — testbar + idempotent.
    const key = `${input.brandSlug}/${input.campaignId}/ai-hero-${i}.png`;
    const { url } = await storage.upload(key, bytes, img.contentType);
    persisted.push({
      storage_url: url,
      contentType: img.contentType,
      seed: img.seed,
    });
  }

  return persisted;
}
