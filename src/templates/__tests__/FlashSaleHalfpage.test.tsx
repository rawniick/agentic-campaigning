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

// V1.2-Vertrag: die Halfpage rendert jetzt die KANONISCHE Flash-Sale-Anatomie
// (CanonicalPortrait): roter Vollflaechen-BG, "flash sale"-Wordmark, freigestellte
// Person (bleeding), weisser Stern-Blob mit DUNKLEM Preis (#292B2D im Blob, NICHT
// Brand-Primary), CTA, Channel-Footer, Legal. Die alte Slot-Stack-Anatomie
// (Subline-Block, price_top/price_bottom Variant-Reorder) gilt nicht mehr —
// daher keine Subline- + keine Variant-Reorder-Asserts mehr. Headline/Preis/CTA/
// Disclaimer/Logo bleiben verbatim (Compliance: Copy 1:1).
const INK = "#292B2D"; // dunkler Preis im weissen Blob

describe("FlashSaleHalfpage (kanonische Flash-Anatomie)", () => {
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
    const html = renderToStaticMarkup(<FlashSaleHalfpage {...baseProps} />);

    expect(html).toContain("Schweizer Netz, halber Preis.");
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

  it("renders the promo price DARK in the blob (NOT the brand primary)", () => {
    const html = renderToStaticMarkup(<FlashSaleHalfpage {...baseProps} />);
    // Preis dunkel im weissen Stern-Blob (#292B2D), nicht im Akzent-Rot.
    const priceIdx = html.indexOf("19.95");
    const before = html.slice(0, priceIdx);
    const lastColor = [...before.matchAll(/[;"]color:\s*(#[0-9a-fA-F]{3,8})/g)]
      .at(-1)?.[1]
      ?.toLowerCase();
    expect(lastColor).toBe(INK.toLowerCase());
    // Defensiv: der Preis darf NICHT in der Brand-Primaerfarbe stehen.
    expect(lastColor).not.toBe(tokens.colors.primary.hex.toLowerCase());
  });

  it("specifies the 300x600 outer dimensions", () => {
    const html = renderToStaticMarkup(<FlashSaleHalfpage {...baseProps} />);
    expect(html).toMatch(/width:\s*['"]?300/);
    expect(html).toMatch(/height:\s*['"]?600/);
  });

  describe("kanonische Struktur", () => {
    it("renders the 'flash sale' wordmark (zweizeilig, lowercase)", () => {
      const html = renderToStaticMarkup(<FlashSaleHalfpage {...baseProps} />);
      // Wordmark zweizeilig: 'flash' + 'sale' als separate Spans.
      expect(html).toContain(">flash<");
      expect(html).toContain(">sale<");
    });

    it("renders the hero (bleeding, object-fit:contain) and a price blob container", () => {
      const html = renderToStaticMarkup(
        <FlashSaleHalfpage {...baseProps} priceBlobSrc="https://example.test/star-blob.png" />
      );
      // Hero blutet an den Rand — object-fit:contain + absolut positioniert.
      expect(html).toContain('src="https://example.test/hero.jpg"');
      expect(html).toMatch(/object-fit:\s*contain/);
      // Weisser Stern-Blob als Preis-Container (priceBlobSrc als bg).
      expect(html).toContain("https://example.test/star-blob.png");
    });

    it("renders a price blob even without priceBlobSrc (white circle fallback)", () => {
      const html = renderToStaticMarkup(<FlashSaleHalfpage {...baseProps} />);
      // Ohne Blob-Asset: weisser Kreis-Container (#FFFFFF + border-radius).
      expect(html).toMatch(/background-color:\s*#f+/i);
    });

    it("renders the 'Gratis Aktivierung' badge", () => {
      const html = renderToStaticMarkup(<FlashSaleHalfpage {...baseProps} />);
      expect(html).toContain("Gratis");
      expect(html).toContain("Aktivierung");
    });
  });

  describe("Doppelpreis", () => {
    it("renders the dual price (struck-through standard + promo) when productName + priceStandard set", () => {
      const html = renderToStaticMarkup(
        <FlashSaleHalfpage
          {...baseProps}
          productName="Wingo Red"
          priceStandard="78.–"
        />
      );
      expect(html).toContain("Wingo Red");
      expect(html).toContain("78.–");
      expect(html).toContain("nur");
      expect(html).toContain("19.95");
      // Streichpreis durchgestrichen.
      expect(html).toMatch(/text-decoration[a-z-]*:\s*line-through/i);
    });
  });
});
