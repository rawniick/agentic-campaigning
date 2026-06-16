import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchAssetBytesFromUrl } from "../fetchAssetBytes";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAssetBytesFromUrl", () => {
  it("returns the response body as a Buffer", async () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(data, { status: 200 }))
    );

    const buf = await fetchAssetBytesFromUrl("https://example.com/a.png");
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(Array.from(buf)).toEqual([1, 2, 3, 4]);
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 404 }))
    );

    await expect(
      fetchAssetBytesFromUrl("https://example.com/missing.png")
    ).rejects.toThrow(/404/);
  });
});
