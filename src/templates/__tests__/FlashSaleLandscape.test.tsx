import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import path from "path";
import { fileURLToPath } from "url";
import { FlashSaleLandscape } from "../wingo/flash_sale/FlashSaleLandscape";
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

describe("FlashSaleLandscape (1200x628 — PMax / Discovery / Reddit)", () => {
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

  it("renders headline, price, CTA, and disclaimer verbatim", () => {
    const html = renderToStaticMarkup(<FlashSaleLandscape {...baseProps} />);
    expect(html).toContain("Schweizer Netz, halber Preis.");
    expect(html).toContain("19.95");
    expect(html).toContain("/Mt.");
    expect(html).toContain("Jetzt entdecken");
    expect(html).toContain("5G im Swisscom Netz");
  });

  it("emits hero image and logo as <img> elements", () => {
    const html = renderToStaticMarkup(<FlashSaleLandscape {...baseProps} />);
    expect(html).toContain('src="https://example.test/hero.jpg"');
    expect(html).toContain('src="https://example.test/wingo-lockup.svg"');
  });

  it("uses the brand primary color for the promo price", () => {
    const html = renderToStaticMarkup(<FlashSaleLandscape {...baseProps} />);
    expect(html).toContain(tokens.colors.primary.hex);
  });

  it("specifies the 1200x628 outer dimensions", () => {
    const html = renderToStaticMarkup(<FlashSaleLandscape {...baseProps} />);
    expect(html).toMatch(/width:\s*['"]?1200/);
    expect(html).toMatch(/height:\s*['"]?628/);
  });
});
