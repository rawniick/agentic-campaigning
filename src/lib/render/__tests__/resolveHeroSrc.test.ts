// @vitest-environment node

import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { resolveHeroSrc } from "../resolveHeroSrc";

async function solidImage(
  fmt: "png" | "jpeg" | "webp",
  rgb: { r: number; g: number; b: number } = { r: 10, g: 20, b: 30 }
): Promise<Buffer> {
  return sharp({ create: { width: 32, height: 24, channels: 3, background: rgb } })
    [fmt]()
    .toBuffer();
}

describe("resolveHeroSrc", () => {
  it("fetches a remote hero and embeds it as a PNG data URI", async () => {
    const jpeg = await solidImage("jpeg");
    const out = await resolveHeroSrc(
      "https://storage.example/hero.jpg",
      async () => jpeg
    );
    expect(out.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("transcodes a WebP hero to PNG (resvg cannot decode WebP)", async () => {
    const webp = await solidImage("webp");
    const out = await resolveHeroSrc(
      "https://storage.example/hero.webp",
      async () => webp
    );
    expect(out.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("throws on a non-image 200 body so the caller can fail the asset", async () => {
    await expect(
      resolveHeroSrc("https://storage.example/oops", async () =>
        Buffer.from('{"error":"not an image"}')
      )
    ).rejects.toThrow();
  });

  it("passes an already-embedded data URI through unchanged without fetching", async () => {
    let fetched = false;
    const out = await resolveHeroSrc("data:image/png;base64,QQ==", async () => {
      fetched = true;
      return Buffer.alloc(0);
    });
    expect(out).toBe("data:image/png;base64,QQ==");
    expect(fetched).toBe(false);
  });

  it("leaves non-http schemes unchanged without fetching", async () => {
    let fetched = false;
    const out = await resolveHeroSrc("memory://hero.jpg", async () => {
      fetched = true;
      return Buffer.alloc(0);
    });
    expect(out).toBe("memory://hero.jpg");
    expect(fetched).toBe(false);
  });
});
