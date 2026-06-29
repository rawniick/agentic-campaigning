import { describe, it, expect, vi } from "vitest";
import { createInMemoryStorage } from "../../storage/inMemoryStorage";
import { createMockImageProvider } from "../../imagegen/mockImageProvider";
import type {
  ImageProvider,
  GenerateInput,
  GeneratedImage,
  ModelEntry,
} from "../../imagegen/types";
import { generateHeroCandidatesForGate } from "../generateHeroCandidatesForGate";

// Injizierter Fake-Download: liefert deterministische Bytes pro fal-URL, damit der
// Persistierungs-Schritt ohne echtes fetch testbar ist.
const fakeFetchBytes = async (url: string): Promise<Buffer> =>
  Buffer.from("img-" + url);

const BASE = {
  campaignId: "11111111-1111-1111-1111-111111111111",
  brandSlug: "wingo",
  prompt: "Wingo Flash Sale Hero, Swiss Alps",
};

describe("generateHeroCandidatesForGate (Gate 2 — AI generieren)", () => {
  it("returns n candidates (default 3) each persisted to a memory:// storage_url", async () => {
    const provider = createMockImageProvider();
    const storage = createInMemoryStorage();

    const out = await generateHeroCandidatesForGate(
      provider,
      storage,
      { ...BASE },
      fakeFetchBytes
    );

    expect(out).toHaveLength(3);
    out.forEach((c, i) => {
      expect(c.storage_url.startsWith("memory://")).toBe(true);
      const key = c.storage_url.replace("memory://", "");
      // Schluessel ist deterministisch (Index, kein Date.now()) — sonst flaky.
      expect(key).toBe(`wingo/${BASE.campaignId}/ai-hero-${i}.png`);
      expect(storage.has(key)).toBe(true);
    });
  });

  it("forwards referenceUrls into generateHeroCandidates as styleReferenceUrls", async () => {
    const seen: GenerateInput[] = [];
    // Mini-Spy-Provider: zeichnet das empfangene GenerateInput auf.
    const spyProvider: ImageProvider = {
      name: "spy",
      async generate(
        _model: ModelEntry,
        i: GenerateInput
      ): Promise<GeneratedImage[]> {
        seen.push(i);
        return [{ url: "fal://x/0.png", contentType: "image/png", seed: 0 }];
      },
    };
    const storage = createInMemoryStorage();
    const refs = [
      "memory://wingo/comp-a.png",
      "https://example.com/lib-ref.jpg",
    ];

    await generateHeroCandidatesForGate(
      spyProvider,
      storage,
      { ...BASE, referenceUrls: refs },
      fakeFetchBytes
    );

    expect(seen).toHaveLength(1);
    expect(seen[0].styleReferenceUrls).toEqual(refs);
  });

  it("honors n (n=2 -> 2 candidates)", async () => {
    const provider = createMockImageProvider();
    const storage = createInMemoryStorage();

    const out = await generateHeroCandidatesForGate(
      provider,
      storage,
      { ...BASE, n: 2 },
      fakeFetchBytes
    );

    expect(out).toHaveLength(2);
  });

  it("rejects an empty/whitespace prompt", async () => {
    const provider = createMockImageProvider();
    const storage = createInMemoryStorage();

    await expect(
      generateHeroCandidatesForGate(
        provider,
        storage,
        { ...BASE, prompt: "   " },
        fakeFetchBytes
      )
    ).rejects.toThrow(/prompt/i);
  });

  it("persists the GeneratedImage content-type (mock -> image/png)", async () => {
    const provider = createMockImageProvider();
    const storage = createInMemoryStorage();

    const out = await generateHeroCandidatesForGate(
      provider,
      storage,
      { ...BASE },
      fakeFetchBytes
    );

    for (const c of out) {
      expect(c.contentType).toBe("image/png");
    }
  });
});
