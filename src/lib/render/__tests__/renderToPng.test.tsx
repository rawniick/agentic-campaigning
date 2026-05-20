// @vitest-environment node

import { describe, it, expect } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import { renderToPng } from "../renderToPng";
import { FlashSaleHalfpage } from "../../../templates/wingo/flash_sale/FlashSaleHalfpage";
import { loadBrandTokens } from "../../brand/loadTokens";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_BASE_DIR = path.join(
  __dirname,
  "..",
  "..",
  "brand",
  "__tests__",
  "fixtures"
);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPngDimensions(buf: Buffer): { width: number; height: number } {
  // PNG IHDR liegt direkt nach dem 8-Byte-Signature.
  // Bytes 16-19 = width (big-endian uint32), 20-23 = height.
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe("renderToPng", () => {
  it("produces a valid 300x600 PNG for the FlashSaleHalfpage template", async () => {
    const tokens = loadBrandTokens("wingo", { baseDir: FIXTURE_BASE_DIR });

    const png = await renderToPng(
      <FlashSaleHalfpage
        tokens={tokens}
        headline="Schweizer Netz, halber Preis."
        subline="Unlimitiert telefonieren im Swisscom Netz."
        pricePromo="19.95"
        priceSuffix="/Mt."
        ctaLabel="Jetzt entdecken"
        disclaimer="5G im Swisscom Netz"
        heroImageUrl="https://placehold.co/300x200/EFEFEF/E61E2A.png"
        logoSrc="https://placehold.co/80x24/EFEFEF/E61E2A.png?text=wingo"
      />,
      { width: 300, height: 600 }
    );

    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);

    const dims = readPngDimensions(png);
    expect(dims.width).toBe(300);
    expect(dims.height).toBe(600);
  }, 30_000);
});
