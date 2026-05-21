import { describe, it, expect } from "vitest";
import { buildTranslatorPrompt } from "../translatorPrompt";

const SOURCE = {
  headlines: ["Schweizer Netz, halber Preis.", "Wingo Mobile Swiss fuer 19.95.", "Headline 3"],
  subline: "Unlimitiert telefonieren im Swisscom Netz.",
  cta_label: "Jetzt entdecken",
};

const TERMS = ["Wingo", "Wingo Mobile Swiss", "Swisscom", "5G im Swisscom Netz"];

describe("buildTranslatorPrompt", () => {
  it("lists every passthrough term in the system prompt", () => {
    const { systemPrompt } = buildTranslatorPrompt({
      sourceCopy: SOURCE,
      passthroughTerms: TERMS,
    });
    for (const term of TERMS) {
      expect(systemPrompt).toContain(term);
    }
  });

  it("explicitly forbids translating prices and disclaimers", () => {
    const { systemPrompt } = buildTranslatorPrompt({
      sourceCopy: SOURCE,
      passthroughTerms: TERMS,
    });
    expect(systemPrompt.toLowerCase()).toMatch(/preise|prices|price/);
    expect(systemPrompt.toLowerCase()).toMatch(/disclaimer/);
  });

  it("requires JSON output shaped { fr, it, en } each with headlines/subline/cta_label", () => {
    const { systemPrompt } = buildTranslatorPrompt({
      sourceCopy: SOURCE,
      passthroughTerms: TERMS,
    });
    expect(systemPrompt).toContain('"fr"');
    expect(systemPrompt).toContain('"it"');
    expect(systemPrompt).toContain('"en"');
    expect(systemPrompt).toContain("headlines");
    expect(systemPrompt).toContain("subline");
    expect(systemPrompt).toContain("cta_label");
  });

  it("places the DE source copy verbatim in the user message", () => {
    const { userMessage } = buildTranslatorPrompt({
      sourceCopy: SOURCE,
      passthroughTerms: TERMS,
    });
    expect(userMessage).toContain("Schweizer Netz, halber Preis.");
    expect(userMessage).toContain("Unlimitiert telefonieren im Swisscom Netz.");
    expect(userMessage).toContain("Jetzt entdecken");
  });
});
