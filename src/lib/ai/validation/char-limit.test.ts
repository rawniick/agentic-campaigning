import { describe, it, expect } from "vitest";
import { validateCharLimits, adjustLimitsForLanguage } from "./char-limit";

describe("validateCharLimits", () => {
  it("markiert SEA Headline >30 als CRITICAL", () => {
    const content = {
      sea: {
        headlines: ["Dies ist eine viel zu lange Headline fuer SEA Kampagnen ja"],
      },
    };
    const result = validateCharLimits(content);
    expect(result.valid).toBe(false);
    expect(result.warnings[0].severity).toBe("CRITICAL");
    expect(result.warnings[0].field).toContain("sea.headlines");
  });

  it("akzeptiert SEA Headline <=30 Zeichen", () => {
    const content = {
      sea: {
        headlines: ["Jetzt 50% sparen"],
      },
    };
    const result = validateCharLimits(content);
    expect(result.valid).toBe(true);
  });

  it("markiert SEA Description >90 als CRITICAL", () => {
    const longDesc = "A".repeat(91);
    const content = {
      sea: {
        descriptions: [longDesc],
      },
    };
    const result = validateCharLimits(content);
    expect(result.valid).toBe(false);
    expect(result.warnings[0].severity).toBe("CRITICAL");
  });

  it("markiert CRM Subject >50 als WARNING", () => {
    const content = {
      crm: {
        subject_line: "Dies ist ein sehr langer CRM Subject Line Text der das Limit sprengt",
      },
    };
    const result = validateCharLimits(content);
    expect(result.valid).toBe(true); // WARNING = valid
    expect(result.warnings[0].severity).toBe("WARNING");
    expect(result.warnings[0].field).toBe("crm.subject_line");
  });

  it("passt CRM Limits fuer FR an (+15%)", () => {
    // 50 * 1.15 = 57
    const content = {
      crm: {
        subject_line: "A".repeat(55), // ueber 50, aber unter 57
      },
    };
    const result = validateCharLimits(content, "fr");
    expect(result.warnings).toHaveLength(0);
  });

  it("passt SEA Limits NICHT fuer FR an", () => {
    const content = {
      sea: {
        headlines: ["A".repeat(31)], // 31 > 30
      },
    };
    const result = validateCharLimits(content, "fr");
    expect(result.valid).toBe(false);
    expect(result.warnings[0].limit).toBe(30);
  });

  it("warnt bei Claims >8 Woerter", () => {
    const content = {
      claims: [
        "Kurz und gut",
        "Das ist ein sehr langer Claim der viel zu viele Woerter hat und ueberarbeitet werden muss",
      ],
    };
    const result = validateCharLimits(content);
    expect(result.warnings.some((w) => w.field.startsWith("claims"))).toBe(true);
    expect(result.warnings[0].severity).toBe("WARNING");
  });
});

describe("adjustLimitsForLanguage", () => {
  it("FR: SEA Limits bleiben gleich, CRM erhoelt", () => {
    const adjusted = adjustLimitsForLanguage("fr");
    expect(adjusted["sea.headlines"]).toBe(30);
    expect(adjusted["sea.descriptions"]).toBe(90);
    expect(adjusted["crm.subject_line"]).toBe(57); // 50 * 1.15 = 57
  });

  it("DE: keine Anpassung", () => {
    const adjusted = adjustLimitsForLanguage("de");
    expect(adjusted["crm.subject_line"]).toBe(50);
  });
});
