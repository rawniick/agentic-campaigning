import { describe, it, expect } from "vitest";
import { generateHeroCandidates } from "../engine";
import { createMockImageProvider } from "../mockImageProvider";

describe("generateHeroCandidates", () => {
  const provider = createMockImageProvider();

  it("liefert N Kandidaten (Default 3)", async () => {
    const r = await generateHeroCandidates(provider, { input: { prompt: "wingo hero" } });
    expect(r).toHaveLength(3);
    expect(r[0].contentType).toBe("image/png");
  });

  it("respektiert n", async () => {
    const r = await generateHeroCandidates(provider, {
      input: { prompt: "x", n: 5 },
    });
    expect(r).toHaveLength(5);
  });

  it("wirft bei unbekanntem Modell", async () => {
    await expect(
      generateHeroCandidates(provider, { modelId: "nope", input: { prompt: "x" } })
    ).rejects.toThrow(/Unbekannt/i);
  });

  it("wirft bei deaktiviertem Modell (z.B. Video/Seedance)", async () => {
    await expect(
      generateHeroCandidates(provider, {
        modelId: "seedance-2-i2v",
        input: { prompt: "x" },
      })
    ).rejects.toThrow(/nicht aktiviert/i);
  });

  it("propagiert Provider-Fehler wenn kein aktivierter Fallback existiert", async () => {
    const failing = createMockImageProvider({ failModelIds: ["nano-banana-2"] });
    await expect(
      generateHeroCandidates(failing, { input: { prompt: "x" } })
    ).rejects.toThrow(/simuliert Fehler/);
  });
});
