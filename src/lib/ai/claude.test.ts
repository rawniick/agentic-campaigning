import { describe, it, expect } from "vitest";
import { parseJsonResponse, estimateCostChf } from "./claude";

describe("parseJsonResponse", () => {
  it("parst direkt JSON", () => {
    const json = '{"key": "value", "num": 42}';
    const result = parseJsonResponse<{ key: string; num: number }>(json);
    expect(result.key).toBe("value");
    expect(result.num).toBe(42);
  });

  it("extrahiert JSON aus Markdown-Codeblock", () => {
    const text = 'Hier ist das Ergebnis:\n```json\n{"key": "value"}\n```';
    const result = parseJsonResponse<{ key: string }>(text);
    expect(result.key).toBe("value");
  });

  it("extrahiert JSON aus Codeblock ohne Sprach-Tag", () => {
    const text = '```\n{"key": "value"}\n```';
    const result = parseJsonResponse<{ key: string }>(text);
    expect(result.key).toBe("value");
  });

  it("extrahiert JSON via Klammern-Suche", () => {
    const text = 'Hier ist das JSON: {"key": "value"} und danach kommt Text.';
    const result = parseJsonResponse<{ key: string }>(text);
    expect(result.key).toBe("value");
  });

  it("wirft bei ungueltigem JSON", () => {
    expect(() => parseJsonResponse("kein json hier")).toThrow("JSON-Parsing fehlgeschlagen");
  });
});

describe("estimateCostChf", () => {
  it("berechnet Kosten korrekt", () => {
    // 1M Input * 3 USD/M + 1M Output * 15 USD/M = 18 USD * 0.88 = 15.84 CHF
    const cost = estimateCostChf(1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(15.84, 2);
  });

  it("gibt 0 fuer 0 Tokens", () => {
    const cost = estimateCostChf(0, 0);
    expect(cost).toBe(0);
  });

  it("berechnet typische Aufruf-Kosten", () => {
    // 2000 Input, 500 Output
    const cost = estimateCostChf(2000, 500);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.02);
  });
});
