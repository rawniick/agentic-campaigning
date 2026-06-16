import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { resolveLogoSrc, logoIsPlaceholder } from "../resolveLogoSrc";
import { loadBrandTokens } from "../loadTokens";

// 1x1 transparentes PNG.
const PNG_1x1_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

const tokens = loadBrandTokens("wingo");

describe("resolveLogoSrc", () => {
  it("returns the real PNG as a base64 data-url when the lockup file is present", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "logo-real-"));
    const dir = path.join(tmp, "wingo", "logos");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "wingo-lockup@3x.png"),
      Buffer.from(PNG_1x1_B64, "base64")
    );

    const src = resolveLogoSrc(tokens, "wingo", { baseDir: tmp });
    expect(src).toBe(`data:image/png;base64,${PNG_1x1_B64}`);
  });

  it("falls back to a rasterized interim PNG data-url when no lockup file exists", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "logo-interim-"));

    const src = resolveLogoSrc(tokens, "wingo", { baseDir: tmp });
    expect(src.startsWith("data:image/png;base64,")).toBe(true);

    const bytes = Buffer.from(src.split(",")[1], "base64");
    // PNG-Magic-Bytes — beweist echtes PNG, nicht SVG.
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});

describe("logoIsPlaceholder", () => {
  it("is false when a real lockup PNG exists", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "logo-flag-real-"));
    const dir = path.join(tmp, "wingo", "logos");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "wingo-lockup@3x.png"),
      Buffer.from(PNG_1x1_B64, "base64")
    );

    expect(logoIsPlaceholder("wingo", { baseDir: tmp })).toBe(false);
  });

  it("is true when no lockup PNG exists (interim placeholder in use)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "logo-flag-interim-"));
    expect(logoIsPlaceholder("wingo", { baseDir: tmp })).toBe(true);
  });
});
