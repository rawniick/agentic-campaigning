import { describe, it, expect } from "vitest";
import { createMockEmbeddingProvider } from "../mockEmbeddingProvider";

describe("createMockEmbeddingProvider", () => {
  it("returns seeded vectors for known text", async () => {
    const provider = createMockEmbeddingProvider({
      sport: [1, 0, 0],
      familie: [0, 1, 0],
    });

    expect(await provider.embed("sport")).toEqual([1, 0, 0]);
    expect(await provider.embed("familie")).toEqual([0, 1, 0]);
  });

  it("throws on unseeded text so tests surface unexpected inputs", async () => {
    const provider = createMockEmbeddingProvider({ sport: [1, 0, 0] });

    await expect(provider.embed("unseeded")).rejects.toThrow(/no seed/i);
  });
});
