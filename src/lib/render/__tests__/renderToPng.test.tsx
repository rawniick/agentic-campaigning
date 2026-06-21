// @vitest-environment node

import { describe, it, expect } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { renderToPng } from "../renderToPng";
import { FlashSaleHalfpage } from "../../../templates/wingo/flash_sale/FlashSaleHalfpage";
import { loadBrandTokens } from "../../brand/loadTokens";
import { checkBrandConformity } from "../../qa/checkBrandConformity";

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

  // KO-Real-Boundary: der ECHTE Satori/resvg-Render muss das Hero-Bild tatsaechlich
  // malen. Frueher bekam Satori eine Remote-URL (die es nicht fetcht) -> Hero blank.
  // Hier als eingebettete Data-URI -> der Hero-Bereich darf NICHT die BG-Farbe sein.
  it("paints the embedded hero image into the hero region (real render, not blank)", async () => {
    const tokens = loadBrandTokens("wingo", { baseDir: FIXTURE_BASE_DIR });

    // Fixture-Hero: reines Blau — klar verschieden von BG-Grau (#EFEFEF) und Primary-Rot.
    const heroPng = await sharp({
      create: { width: 300, height: 200, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .png()
      .toBuffer();
    const logoPng = await sharp({
      create: { width: 80, height: 24, channels: 3, background: { r: 230, g: 30, b: 42 } },
    })
      .png()
      .toBuffer();

    const png = await renderToPng(
      <FlashSaleHalfpage
        tokens={tokens}
        headline="Schweizer Netz, halber Preis."
        subline="Unlimitiert telefonieren."
        pricePromo="19.95"
        priceSuffix="/Mt."
        ctaLabel="Jetzt entdecken"
        disclaimer="5G im Swisscom Netz"
        heroImageUrl={`data:image/png;base64,${heroPng.toString("base64")}`}
        logoSrc={`data:image/png;base64,${logoPng.toString("base64")}`}
      />,
      { width: 300, height: 600 }
    );

    const { data, info } = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => {
      const i = (y * info.width + x) * info.channels;
      return { r: data[i], g: data[i + 1], b: data[i + 2] };
    };

    // Default-Variant 'price_bottom': logo (~48px) → hero (200px). Mitte des Heros.
    const hero = at(150, 140);
    expect(hero.b).toBeGreaterThan(150); // Blau dominiert → Hero wurde gemalt
    expect(hero.r).toBeLessThan(120);
    expect(hero.g).toBeLessThan(120);
  }, 30_000);

  // Real-Boundary fuer V1.1 Standard: ein ECHT gerendertes Asset mit
  // emphasis='neutral' (Preis NICHT im Akzent) muss den deterministischen
  // Brand-Konformitaets-Gate trotzdem bestehen — die Brand-Primaerfarbe kommt
  // weiter ueber CTA + Logo, also bleibt das KO-Kriterium erfuellt.
  it("a neutral-emphasis (Standard) render still passes the brand-conformity KO-gate", async () => {
    const tokens = loadBrandTokens("wingo", { baseDir: FIXTURE_BASE_DIR });

    const heroPng = await sharp({
      create: { width: 300, height: 200, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .png()
      .toBuffer();
    // Logo in Brand-Rot (~#E61E2A) — liefert zusammen mit dem roten CTA die Primaerfarbe.
    const logoPng = await sharp({
      create: { width: 80, height: 24, channels: 3, background: { r: 230, g: 30, b: 42 } },
    })
      .png()
      .toBuffer();

    const png = await renderToPng(
      <FlashSaleHalfpage
        tokens={tokens}
        headline="Schweizer Netz, fairer Preis."
        subline="Unlimitiert telefonieren im Swisscom Netz."
        pricePromo="19.95"
        priceSuffix="/Mt."
        ctaLabel="Jetzt entdecken"
        disclaimer="5G im Swisscom Netz"
        heroImageUrl={`data:image/png;base64,${heroPng.toString("base64")}`}
        logoSrc={`data:image/png;base64,${logoPng.toString("base64")}`}
        emphasis="neutral"
      />,
      { width: 300, height: 600 }
    );

    const conformity = await checkBrandConformity({
      pngBytes: png,
      expectedWidth: 300,
      expectedHeight: 600,
      brandPrimaryHex: tokens.colors.primary.hex,
      logoIsPlaceholder: false,
    });

    expect(conformity.pass).toBe(true);
    expect(
      conformity.checks.find((c) => c.name === "brand_color")?.pass
    ).toBe(true);
  }, 30_000);
});
