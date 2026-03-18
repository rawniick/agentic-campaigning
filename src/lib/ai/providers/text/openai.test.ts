import { describe, it, expect } from "vitest";
import { openaiProvider } from "./openai";

describe("openaiProvider", () => {
  describe("metadata", () => {
    it("hat korrekte ID und Capability", () => {
      expect(openaiProvider.id).toBe("openai");
      expect(openaiProvider.capability).toBe("text");
      expect(openaiProvider.displayName).toBe("OpenAI GPT");
    });

    it("ist nicht verfuegbar ohne OPENAI_API_KEY", () => {
      const original = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      expect(openaiProvider.isAvailable()).toBe(false);
      if (original) process.env.OPENAI_API_KEY = original;
    });
  });

  describe("parseJsonResponse", () => {
    it("parst direkt JSON", () => {
      const json = '{"key": "value", "num": 42}';
      const result = openaiProvider.parseJsonResponse<{ key: string; num: number }>(json);
      expect(result.key).toBe("value");
      expect(result.num).toBe(42);
    });

    it("extrahiert JSON aus Markdown-Codeblock", () => {
      const text = 'Hier ist das Ergebnis:\n```json\n{"key": "value"}\n```';
      const result = openaiProvider.parseJsonResponse<{ key: string }>(text);
      expect(result.key).toBe("value");
    });

    it("extrahiert JSON aus Codeblock ohne Sprach-Tag", () => {
      const text = '```\n{"key": "value"}\n```';
      const result = openaiProvider.parseJsonResponse<{ key: string }>(text);
      expect(result.key).toBe("value");
    });

    it("extrahiert JSON via Klammern-Suche", () => {
      const text = 'Hier ist das JSON: {"key": "value"} und danach kommt Text.';
      const result = openaiProvider.parseJsonResponse<{ key: string }>(text);
      expect(result.key).toBe("value");
    });

    it("parst verschachteltes JSON", () => {
      const json = '{"kampagne": {"claims": ["Claim 1", "Claim 2"], "leitidee": "Test"}}';
      const result = openaiProvider.parseJsonResponse<{ kampagne: { claims: string[] } }>(json);
      expect(result.kampagne.claims).toHaveLength(2);
    });

    it("wirft bei ungueltigem JSON", () => {
      expect(() => openaiProvider.parseJsonResponse("kein json hier")).toThrow("JSON-Parsing fehlgeschlagen");
    });

    it("wirft bei leerem String", () => {
      expect(() => openaiProvider.parseJsonResponse("")).toThrow("JSON-Parsing fehlgeschlagen");
    });
  });
});
