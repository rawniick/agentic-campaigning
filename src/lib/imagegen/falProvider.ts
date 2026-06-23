import type {
  ImageProvider,
  ModelEntry,
  GenerateInput,
  GeneratedImage,
} from "./types";

// fal.ai-Adapter ueber die REST-API (kein zusaetzlicher SDK-Dep). Synchroner
// Endpoint fuer Bild-Modelle (schnell, ~5-10s). FAL_KEY ist Pflicht.
//
// HINWEIS: Bis fal-Key + Lizenz-Freigabe (Gemini/ByteDance fuer kommerzielle
// Swisscom/Wingo-Werbung — rechtliche Frage!) vorliegen, ist dieser Pfad
// untested-live; die Engine-Logik wird in Tests ueber den Mock-Provider gedeckt.
// fetchImpl ist injizierbar fuer einen kuenftigen Integrationstest.
export function createFalImageProvider(
  fetchImpl: typeof fetch = fetch
): ImageProvider {
  return {
    name: "fal",
    async generate(
      model: ModelEntry,
      input: GenerateInput
    ): Promise<GeneratedImage[]> {
      const key = process.env.FAL_KEY;
      if (!key) throw new Error("FAL_KEY ist nicht gesetzt");
      if (model.provider !== "fal") {
        throw new Error(
          `falProvider kann ein Modell von Provider '${model.provider}' nicht bedienen`
        );
      }

      const body: Record<string, unknown> = {
        prompt: input.prompt,
        num_images: input.n ?? 3,
        ...(input.aspectRatio ? { aspect_ratio: input.aspectRatio } : {}),
        // Brand-Style-Lock: Referenzbilder nur wenn das Modell sie unterstuetzt.
        ...(input.styleReferenceUrls?.length && model.supportsStyleRef
          ? { image_urls: input.styleReferenceUrls }
          : {}),
        ...input.modelParams,
      };

      const res = await fetchImpl(`https://fal.run/${model.providerModelId}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`fal ${model.providerModelId} -> HTTP ${res.status}`);
      }

      // Output-Schema ist modell-spezifisch; Bild-Modelle liefern { images: [...] }.
      const data = (await res.json()) as {
        images?: Array<{ url: string; content_type?: string }>;
      };
      const images = data.images ?? [];
      if (images.length === 0) throw new Error("fal lieferte keine Bilder");
      return images.map((img) => ({
        url: img.url,
        contentType: img.content_type ?? "image/png",
      }));
    },
  };
}
