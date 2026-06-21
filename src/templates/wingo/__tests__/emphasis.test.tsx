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

// V1.1: Flash Sale ist preis-getrieben (Preis im Akzent = Dringlichkeit),
// Standard ist botschafts-getrieben (Preis neutral). Der einzige visuelle
// Unterschied ist das Emphasis-Treatment des Preises, gesetzt per `emphasis`-Prop.
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
    "%s: urgency (default) paints the promo price in the brand accent",
    (code) => {
      const Component = findTemplate(code, "flash_sale")!;
      const html = renderToStaticMarkup(React.createElement(Component, baseProps));
      expect(priceColor(html)).toBe(primary);
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
