import { describe, it, expect } from "vitest";
import { createInMemoryStorage } from "../inMemoryStorage";

describe("InMemoryAssetStorage", () => {
  it("returns a public URL after upload and retains the bytes for read-back", async () => {
    const storage = createInMemoryStorage();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const { url } = await storage.upload(
      "wingo/test/asset.png",
      png,
      "image/png"
    );

    expect(url).toContain("wingo/test/asset.png");

    const stored = storage.read("wingo/test/asset.png");
    expect(stored?.equals(png)).toBe(true);
  });
});
