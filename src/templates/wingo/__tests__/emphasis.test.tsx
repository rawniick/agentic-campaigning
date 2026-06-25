import { describe, it, expect } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { findTemplate, listRegisteredFormatCodes } from "../registry";
import { loadBrandTokens } from "../../../lib/brand/loadTokens";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_BASE_DIR = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "lib",
  "brand",
  "__tests__",
  "fixtures"
);

const PRICE = "19.95";

// Liest die wrappende Textfarbe des Preises aus dem statischen Markup:
// die letzte `color:`-Deklaration VOR dem Preistext (nicht `background-color:`,
// das ist per `[;"]`-Anker ausgeschlossen). In allen Templates ist `color`
// die letzte Style-Property des Preis-Containers.
function priceColor(html: string): string | undefined {
  const idx = html.indexOf(PRICE);
  if (idx < 0) return undefined;
  const before = html.slice(0, idx);
  const matches = [...before.matchAll(/[;"]color:\s*(#[0-9a-fA-F]{3,8})/g)];
  return matches.at(-1)?.[1]?.toLowerCase();
}

// V1.2: Flash Sale rendert die kanonische Anatomie — der Preis liegt im weissen
// Stern-Blob und ist daher DUNKEL (#292B2D ink), NICHT im Brand-Akzent-Rot (der
// rote Vollflaechen-BG ist das Dringlichkeits-Signal, nicht die Preisfarbe).
// Standard bleibt botschafts-getrieben: der Preis ist neutral (NICHT im Akzent).
// Der visuelle Flash-vs-Standard-Unterschied ist das Emphasis-Treatment, gesetzt
// per `emphasis`-Prop.
const INK = "#292b2d"; // dunkler Preis im weissen Flash-Blob (lowercase fuer Vergleich)

describe("template emphasis — price treatment by campaign art", () => {
  const tokens = loadBrandTokens("wingo", { baseDir: FIXTURE_BASE_DIR });
  const primary = tokens.colors.primary.hex.toLowerCase();

  const baseProps = {
    tokens,
    headline: "H",
    subline: "S",
    pricePromo: PRICE,
    priceSuffix: "/Mt.",
    ctaLabel: "CTA",
    disclaimer: "D",
    heroImageUrl: "https://example.com/hero.jpg",
    logoSrc: "https://example.com/logo.svg",
  };

  const codes = listRegisteredFormatCodes("flash_sale");

  it.each(codes)(
    "%s: urgency (default, Flash) paints the promo price DARK in the blob (not the accent)",
    (code) => {
      const Component = findTemplate(code, "flash_sale")!;
      const html = renderToStaticMarkup(React.createElement(Component, baseProps));
      // Neuer Vertrag: Preis dunkel im weissen Stern-Blob (#292B2D), NICHT Rot.
      expect(priceColor(html)).toBe(INK);
      expect(priceColor(html)).not.toBe(primary);
    }
  );

  it.each(codes)(
    "%s: neutral emphasis paints the promo price NOT in the accent",
    (code) => {
      const Component = findTemplate(code, "standard")!;
      const html = renderToStaticMarkup(
        React.createElement(Component, { ...baseProps, emphasis: "neutral" })
      );
      const c = priceColor(html);
      expect(c, `price color rendered for ${code}`).toBeDefined();
      expect(c).not.toBe(primary);
    }
  );
});
