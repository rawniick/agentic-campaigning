// @vitest-environment node

import { describe, it, expect } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { findTemplate, listRegisteredFormatCodes } from "../wingo/registry";
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

// KO-Kriterium "Logo nicht verzerren": Satori streckt ein <img> mit fixem
// width+height per Default auf die Slot-Dimension (objectFit:fill). Sobald das
// echte Wingo-Lockup ein anderes Seitenverhaeltnis als der Slot hat, wird es
// verzerrt. Jedes Template MUSS das Logo mit object-fit:contain rendern — dann
// skaliert es proportional in die Box (Letterbox statt Verzerrung). Dieser Test
// erzwingt die Invariante fuer ALLE registrierten Layouts, auch kuenftige.

describe("logo conformity: kein Template verzerrt das Wingo-Logo", () => {
  const tokens = loadBrandTokens("wingo", { baseDir: FIXTURE_BASE_DIR });
  const baseProps = {
    tokens,
    headline: "H",
    subline: "S",
    pricePromo: "19.95",
    priceSuffix: "/Mt.",
    ctaLabel: "CTA",
    disclaimer: "D",
    heroImageUrl: "https://example.com/hero.jpg",
    logoSrc: "https://example.com/logo.svg",
  };

  const cases = (["flash_sale", "standard"] as const).flatMap((art) =>
    listRegisteredFormatCodes(art).map((code) => [art, code] as const)
  );

  it.each(cases)(
    "%s/%s rendert das Logo mit object-fit:contain (keine Verzerrung)",
    (art, code) => {
      const Component = findTemplate(code, art);
      expect(Component, `template ${code}/${art} registriert`).toBeDefined();

      const html = renderToStaticMarkup(
        React.createElement(Component!, baseProps)
      );
      // Global matchen + auf genau ein Treffer bestehen: so kann ein kuenftiges
      // zweites alt="Wingo"-<img> keine Regression am eigentlichen Logo verdecken.
      const logoImgs = html.match(/<img[^>]*alt="Wingo"[^>]*>/g) ?? [];

      expect(
        logoImgs,
        `${art}/${code}: genau ein Logo-<img>`
      ).toHaveLength(1);
      expect(
        logoImgs[0],
        `${art}/${code}: Logo darf nicht gestreckt werden`
      ).toMatch(/object-fit:\s*contain/);
    }
  );
});
