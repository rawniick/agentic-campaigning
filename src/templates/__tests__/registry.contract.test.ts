// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../lib/db/__tests__/fixtures/createTestDb";
import { getV1Formats } from "../../lib/db/queries/format-specs";
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

// Contract: jeder V1-Format-Code aus format_specs muss ein Template haben.
// Wenn jemand ein neues V1-Format seeded ohne Template, schlaegt das hier.

describe("template registry contract", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  // V1.1: jeder V1-Format-Code muss fuer JEDEN unterstuetzten Kampagnentyp ein
  // Template haben (flash_sale UND standard). Fehlt ein Eintrag, rendert der
  // Multiplexer fuer diese Art 0 Assets — das faengt der Contract hier ab.
  it.each(["flash_sale", "standard"] as const)(
    "every V1 format_specs row has a registered %s template",
    async (art) => {
      const v1Formats = await getV1Formats(db);
      const registered = new Set(listRegisteredFormatCodes(art));

      const missing = v1Formats
        .map((f) => f.code)
        .filter((code) => !registered.has(code));

      expect(missing).toEqual([]);
    }
  );

  it("covers exactly 11 V1 formats (V1 scope guard)", async () => {
    const v1Formats = await getV1Formats(db);
    expect(v1Formats).toHaveLength(11);
  });

  it("every flash_sale template renders the AI-Label overlay when aiLabel prop is given", () => {
    const tokens = loadBrandTokens("wingo", { baseDir: FIXTURE_BASE_DIR });
    const aiLabel = {
      src: "https://example.com/wingo-ai-label.svg",
      position: {
        anchor: "bottom-right" as const,
        offset: { x: 6, y: 6 },
        size: { w: 40, h: 14 },
      },
    };
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
      aiLabel,
    };

    const codes = listRegisteredFormatCodes("flash_sale");
    for (const code of codes) {
      const Component = findTemplate(code, "flash_sale");
      expect(Component, `template ${code} should be registered`).toBeDefined();
      const html = renderToStaticMarkup(React.createElement(Component!, baseProps));
      expect(html, `template ${code}`).toContain(
        'src="https://example.com/wingo-ai-label.svg"'
      );
    }
  });
});
