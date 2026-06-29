import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { resolveAiLabelSrc, aiLabelIsPlaceholder } from "../resolveAiLabelSrc";

// 1x1 transparentes PNG (Drop-in-Stellvertreter fuer Nicks offizielles Asset).
const PNG_1x1_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

function writeRealLabel(tmp: string): void {
  const dir = path.join(tmp, "wingo", "ai-label");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "wingo-ai-label@3x.png"),
    Buffer.from(PNG_1x1_B64, "base64")
  );
}

describe("resolveAiLabelSrc", () => {
  it("returns the real PNG as a base64 data-url when the official AI-label asset is present", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ailabel-real-"));
    writeRealLabel(tmp);

    const src = resolveAiLabelSrc("wingo", { baseDir: tmp });
    expect(src).toBe(`data:image/png;base64,${PNG_1x1_B64}`);
  });

  it("falls back to a rasterized interim PNG data-url when no asset exists", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ailabel-interim-"));

    const src = resolveAiLabelSrc("wingo", { baseDir: tmp });
    expect(src.startsWith("data:image/png;base64,")).toBe(true);

    const bytes = Buffer.from(src.split(",")[1], "base64");
    // PNG-Magic-Bytes — beweist echtes PNG (rasterisiert), nicht SVG.
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});

describe("aiLabelIsPlaceholder", () => {
  it("is false when the official AI-label asset exists", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ailabel-flag-real-"));
    writeRealLabel(tmp);
    expect(aiLabelIsPlaceholder("wingo", { baseDir: tmp })).toBe(false);
  });

  it("is true when no asset exists (interim placeholder in use)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ailabel-flag-interim-"));
    expect(aiLabelIsPlaceholder("wingo", { baseDir: tmp })).toBe(true);
  });
});
