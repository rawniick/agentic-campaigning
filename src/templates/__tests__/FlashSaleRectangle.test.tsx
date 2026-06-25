import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import path from "path";
import { fileURLToPath } from "url";
import { FlashSaleRectangle } from "../wingo/flash_sale/FlashSaleRectangle";
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

describe("FlashSaleRectangle (300x250)", () => {
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

  it("renders headline, price, CTA and disclaimer verbatim", () => {
    const html = renderToStaticMarkup(<FlashSaleRectangle {...baseProps} />);
    expect(html).toContain("Schweizer Netz, halber Preis.");
    expect(html).toContain("19.95");
    expect(html).toContain("/Mt.");
    expect(html).toContain("Jetzt entdecken");
    expect(html).toContain("5G im Swisscom Netz");
  });

  it("emits the logo as <img> (Hero entfaellt im kompakten 300x250 Rectangle)", () => {
    const html = renderToStaticMarkup(<FlashSaleRectangle {...baseProps} />);
    // 300x250 ist zu schmal fuer eine Hero-Spalte → die freigestellte Person
    // wird im kompakten Layout bewusst weggelassen, das Logo bleibt Pflicht.
    expect(html).toContain('src="https://example.test/wingo-lockup.svg"');
  });

  it("uses the brand primary color for the promo price", () => {
    const html = renderToStaticMarkup(<FlashSaleRectangle {...baseProps} />);
    expect(html).toContain(tokens.colors.primary.hex);
  });

  it("specifies the 300x250 outer dimensions", () => {
    const html = renderToStaticMarkup(<FlashSaleRectangle {...baseProps} />);
    expect(html).toMatch(/width:\s*['"]?300/);
    expect(html).toMatch(/height:\s*['"]?250/);
  });

  it("renders the AI-Label overlay when aiLabel prop is given", () => {
    const html = renderToStaticMarkup(
      <FlashSaleRectangle
        {...baseProps}
        aiLabel={{
          src: "https://example.test/wingo-ai-label.svg",
          position: {
            anchor: "bottom-right",
            offset: { x: 6, y: 6 },
            size: { w: 40, h: 14 },
          },
        }}
      />
    );
    expect(html).toContain('src="https://example.test/wingo-ai-label.svg"');
    expect(html).toMatch(/right:\s*['"]?6/);
    expect(html).toMatch(/bottom:\s*['"]?6/);
  });

  it("omits the AI-Label markup when aiLabel prop is absent", () => {
    const html = renderToStaticMarkup(<FlashSaleRectangle {...baseProps} />);
    expect(html).not.toContain("AI-generated content label");
  });
});
