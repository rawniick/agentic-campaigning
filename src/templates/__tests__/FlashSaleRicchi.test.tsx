import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import path from "path";
import { fileURLToPath } from "url";
import { FlashSaleRicchi } from "../wingo/flash_sale/FlashSaleRicchi";
import { loadBrandTokens } from "../../lib/brand/loadTokens";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_BASE_DIR = path.join(
  __dirname,
  "..",
  "..",
  "lib",
  "brand",
  "__tests__",
  "fixtures"
);

describe("FlashSaleRicchi (320x416)", () => {
  const tokens = loadBrandTokens("wingo", { baseDir: FIXTURE_BASE_DIR });

  const baseProps = {
    tokens,
    headline: "Schweizer Netz, halber Preis.",
    subline: "Unlimitiert telefonieren.",
    pricePromo: "19.95",
    priceSuffix: "/Mt.",
    ctaLabel: "Jetzt entdecken",
    disclaimer: "5G im Swisscom Netz",
    heroImageUrl: "https://example.test/hero.jpg",
    logoSrc: "https://example.test/wingo-lockup.svg",
  };

  it("renders headline, price, CTA, and disclaimer verbatim", () => {
    const html = renderToStaticMarkup(<FlashSaleRicchi {...baseProps} />);
    expect(html).toContain("Schweizer Netz, halber Preis.");
    expect(html).toContain("19.95");
    expect(html).toContain("/Mt.");
    expect(html).toContain("Jetzt entdecken");
    expect(html).toContain("5G im Swisscom Netz");
  });

  it("emits hero image and logo as <img> elements", () => {
    const html = renderToStaticMarkup(<FlashSaleRicchi {...baseProps} />);
    expect(html).toContain('src="https://example.test/hero.jpg"');
    expect(html).toContain('src="https://example.test/wingo-lockup.svg"');
  });

  // V1.2-Vertrag: Ricchi rendert jetzt die kanonische Flash-Anatomie
  // (CanonicalPortrait). Der Preis liegt DUNKEL (#292B2D) im weissen Stern-Blob,
  // NICHT in der Brand-Primaerfarbe (der rote Vollflaechen-BG ist das
  // Dringlichkeits-Signal). Die alte "Preis im Akzent"-Assertion gilt nicht mehr.
  it("renders the promo price DARK in the blob (NOT the brand primary)", () => {
    const html = renderToStaticMarkup(<FlashSaleRicchi {...baseProps} />);
    const priceIdx = html.indexOf("19.95");
    const before = html.slice(0, priceIdx);
    const lastColor = [...before.matchAll(/[;"]color:\s*(#[0-9a-fA-F]{3,8})/g)]
      .at(-1)?.[1]
      ?.toLowerCase();
    expect(lastColor).toBe("#292b2d");
    expect(lastColor).not.toBe(tokens.colors.primary.hex.toLowerCase());
  });

  it("specifies the 320x416 outer dimensions", () => {
    const html = renderToStaticMarkup(<FlashSaleRicchi {...baseProps} />);
    expect(html).toMatch(/width:\s*['"]?320/);
    expect(html).toMatch(/height:\s*['"]?416/);
  });
});
