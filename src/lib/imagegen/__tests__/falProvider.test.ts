// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createFalImageProvider } from "../falProvider";
import { findModel } from "../registry";

const nano = findModel("nano-banana-2")!;

function jsonFetch(
  body: unknown,
  ok = true,
  status = 200
): typeof fetch {
  return (async () => ({
    ok,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("falProvider", () => {
  const orig = process.env.FAL_KEY;
  beforeEach(() => {
    process.env.FAL_KEY = "test-key";
  });
  afterEach(() => {
    if (orig === undefined) delete process.env.FAL_KEY;
    else process.env.FAL_KEY = orig;
  });

  it("mappt fal images -> GeneratedImage[]", async () => {
    const p = createFalImageProvider(
      jsonFetch({ images: [{ url: "https://x/1.png", content_type: "image/png" }] })
    );
    const r = await p.generate(nano, { prompt: "x", n: 1 });
    expect(r).toHaveLength(1);
    expect(r[0].url).toBe("https://x/1.png");
  });

  it("wirft ohne FAL_KEY", async () => {
    delete process.env.FAL_KEY;
    const p = createFalImageProvider(jsonFetch({ images: [] }));
    await expect(p.generate(nano, { prompt: "x" })).rejects.toThrow(/FAL_KEY/);
  });

  it("wirft bei HTTP-Fehler", async () => {
    const p = createFalImageProvider(jsonFetch({}, false, 500));
    await expect(p.generate(nano, { prompt: "x" })).rejects.toThrow(/HTTP 500/);
  });

  it("schickt styleReferenceUrls nur wenn das Modell sie unterstuetzt", async () => {
    let sentBody: Record<string, unknown> = {};
    const fetchImpl = (async (_url: string, init: { body: string }) => {
      sentBody = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ images: [{ url: "u" }] }) };
    }) as unknown as typeof fetch;
    const p = createFalImageProvider(fetchImpl);
    await p.generate(nano, { prompt: "x", styleReferenceUrls: ["ref1"] });
    expect(sentBody.image_urls).toEqual(["ref1"]); // nano-banana-2 supportsStyleRef
  });
});
