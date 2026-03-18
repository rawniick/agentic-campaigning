import { describe, it, expect } from "vitest";
import { validatePrices, extractPricesFromJson } from "./price-validator";

describe("validatePrices", () => {
  it("akzeptiert korrekten Preis im Text", () => {
    const text = "Das Abo kostet jetzt nur CHF 29.95/Mt.";
    const result = validatePrices(text, { price_new: 29.95 });
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("erkennt fehlenden neuen Preis", () => {
    const text = "Super Angebot fuer das neue Abo!";
    const result = validatePrices(text, { price_new: 29.95 });
    expect(result.valid).toBe(false);
    expect(result.issues[0].field).toBe("price_new");
    expect(result.issues[0].severity).toBe("CRITICAL");
  });

  it("erkennt fehlenden alten Preis", () => {
    const text = "Jetzt nur CHF 29.95 statt...";
    const result = validatePrices(text, {
      price_new: 29.95,
      price_old: 49.95,
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === "price_old")).toBe(true);
  });

  it("prueft Rabatt-Display Text", () => {
    const text = "CHF 29.95 - 40% Rabatt";
    const result = validatePrices(text, {
      price_new: 29.95,
      discount_display: "40% Rabatt",
    });
    expect(result.valid).toBe(true);
  });

  it("erkennt fehlenden Rabatt-Display Text", () => {
    const text = "CHF 29.95 - super guenstig";
    const result = validatePrices(text, {
      price_new: 29.95,
      discount_display: "40% Rabatt",
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === "discount_display")).toBe(true);
  });

  it("erkennt falschen Rabatt (mathematisch)", () => {
    const text = "CHF 29.95 statt CHF 49.95";
    const result = validatePrices(text, {
      price_new: 29.95,
      price_old: 49.95,
      discount_value: 50, // tatsaechlich ~40%, nicht 50%
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === "discount_math")).toBe(true);
  });

  it("erkennt verbotene Preis-Rundung", () => {
    const text = "Nur CHF 29.95 — oder 30.- fuer Einfachheit";
    const result = validatePrices(text, { price_new: 29.95 });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === "price_rounded")).toBe(true);
  });

  it("akzeptiert Preis ohne fuehrendes CHF", () => {
    const text = "Jetzt zugreifen: 29.95/Mt.";
    const result = validatePrices(text, { price_new: 29.95 });
    expect(result.valid).toBe(true);
  });
});

describe("extractPricesFromJson", () => {
  it("extrahiert CHF-Betraege aus verschachteltem JSON", () => {
    const obj = {
      headline: "Ab CHF 29.95",
      nested: {
        old: "Statt CHF 49.95",
        deep: ["CHF 19.90 Rabatt"],
      },
    };
    const prices = extractPricesFromJson(obj);
    expect(prices).toContain("CHF 29.95");
    expect(prices).toContain("CHF 49.95");
    expect(prices).toContain("CHF 19.90");
    expect(prices).toHaveLength(3);
  });

  it("gibt leeres Array bei fehlenden Preisen", () => {
    const obj = { text: "Kein Preis hier" };
    const prices = extractPricesFromJson(obj);
    expect(prices).toHaveLength(0);
  });
});
