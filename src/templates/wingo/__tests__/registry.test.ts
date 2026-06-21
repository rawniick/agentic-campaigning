import { describe, it, expect } from "vitest";
import { findTemplate, listRegisteredFormatCodes } from "../registry";

// V1.1 fuegt den Kampagnentyp 'standard' hinzu. Standard teilt die 11
// Format-Layouts mit flash_sale (gleiche Komponenten); der Unterschied ist
// nur das Emphasis-/Ton-Treatment (Preis nicht im Akzent), das zur Render-Zeit
// gesetzt wird. Die Registry muss daher fuer 'standard' dieselben Formate
// anbieten wie fuer 'flash_sale'.
describe("template registry — Standard campaign art", () => {
  it("registers the same format codes for 'standard' as for 'flash_sale'", () => {
    const flash = [...listRegisteredFormatCodes("flash_sale")].sort();
    const standard = [...listRegisteredFormatCodes("standard")].sort();

    expect(standard).toEqual(flash);
    expect(standard.length).toBeGreaterThan(0);
  });

  it("findTemplate resolves a component for ('dv360_halfpage', 'standard')", () => {
    expect(findTemplate("dv360_halfpage", "standard")).toBeDefined();
  });
});
