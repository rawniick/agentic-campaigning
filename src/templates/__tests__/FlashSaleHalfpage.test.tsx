import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import path from "path";
import { fileURLToPath } from "url";
import { FlashSaleHalfpage } from "../wingo/flash_sale/FlashSaleHalfpage";
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

describe("FlashSaleHalfpage", () => {
  const tokens = loadBrandTokens("wingo", { baseDir: FIXTURE_BASE_DIR });

  const baseProps = {
    tokens,
    headline: "Schweizer Netz, halber Preis.",
    subline: "Unlimitiert telefonieren im Swisscom Netz.",
    pricePromo: "19.95",
    priceSuffix: "/Mt.",
    ctaLabel: "Jetzt entdecken",
    disclaimer: "5G im Swisscom Netz",
    heroImageUrl: "https://example.test/hero.jpg",
    logoSrc: "https://example.test/wingo-lockup.svg",
  };

  it("renders headline, subline, price, CTA, and disclaimer verbatim", () => {
    const html = renderToStaticMarkup(<FlashSaleHalfpage {...baseProps} />);

    expect(html).toContain("Schweizer Netz, halber Preis.");
    expect(html).toContain("Unlimitiert telefonieren im Swisscom Netz.");
    expect(html).toContain("19.95");
    expect(html).toContain("/Mt.");
    expect(html).toContain("Jetzt entdecken");
    expect(html).toContain("5G im Swisscom Netz");
  });

  it("emits hero image and logo as <img> elements", () => {
    const html = renderToStaticMarkup(<FlashSaleHalfpage {...baseProps} />);
    expect(html).toContain('src="https://example.test/hero.jpg"');
    expect(html).toContain('src="https://example.test/wingo-lockup.svg"');
  });

  it("uses the brand primary color for the promo price", () => {
    const html = renderToStaticMarkup(<FlashSaleHalfpage {...baseProps} />);
    expect(html).toContain(tokens.colors.primary.hex);
  });

  it("specifies the 300x600 outer dimensions", () => {
    const html = renderToStaticMarkup(<FlashSaleHalfpage {...baseProps} />);
    expect(html).toMatch(/width:\s*['"]?300/);
    expect(html).toMatch(/height:\s*['"]?600/);
  });

  describe("layout variants", () => {
    // React 19 emit `<link rel="preload" as="image" href="...">` tags vor dem
    // eigentlichen Markup, daher suchen wir nach dem `src=`-Pattern um den
    // tatsaechlichen <img> zu finden, nicht den Preload-Hint.
    const HERO_IMG_PATTERN = 'src="https://example.test/hero.jpg"';

    it("price_top variant places the price BEFORE the hero image in DOM order", () => {
      const html = renderToStaticMarkup(
        <FlashSaleHalfpage {...baseProps} variant="price_top" />
      );
      const priceIdx = html.indexOf("19.95");
      const heroIdx = html.indexOf(HERO_IMG_PATTERN);
      expect(priceIdx).toBeGreaterThan(-1);
      expect(heroIdx).toBeGreaterThan(-1);
      expect(priceIdx).toBeLessThan(heroIdx);
    });

    it("price_bottom variant places the hero image BEFORE the price in DOM order", () => {
      const html = renderToStaticMarkup(
        <FlashSaleHalfpage {...baseProps} variant="price_bottom" />
      );
      const priceIdx = html.indexOf("19.95");
      const heroIdx = html.indexOf(HERO_IMG_PATTERN);
      expect(heroIdx).toBeLessThan(priceIdx);
    });

    it("defaults to price_bottom (= existing layout) when no variant given", () => {
      const html = renderToStaticMarkup(<FlashSaleHalfpage {...baseProps} />);
      const priceIdx = html.indexOf("19.95");
      const heroIdx = html.indexOf(HERO_IMG_PATTERN);
      expect(heroIdx).toBeLessThan(priceIdx);
    });
  });
});
