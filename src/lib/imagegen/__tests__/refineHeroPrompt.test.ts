import { describe, it, expect, vi } from "vitest";
import { refineHeroPrompt } from "../refineHeroPrompt";
import type { ClaudeCallOptions, ClaudeResponse } from "../../ai/claude";

// Kopiert aus claudeTranslator.test.ts: minimaler ClaudeResponse-Wrapper.
function fakeResponse(data: unknown): ClaudeResponse<unknown> {
  return {
    data,
    rawText: JSON.stringify(data),
    tokensUsed: { input: 1, output: 1, total: 2 },
    model: "test",
    stopReason: "end_turn",
  };
}

const VALID = {
  rationale: "Mehr Fokus auf die freigestellte Person am Bildrand.",
  prompt: "Photoreal cut-out of a smiling person, transparent background.",
};

describe("refineHeroPrompt", () => {
  it("returns the llm's rationale and prompt", async () => {
    const llm = vi.fn(
      async (_opts: ClaudeCallOptions) =>
        fakeResponse(VALID) as ClaudeResponse<{
          rationale: string;
          prompt: string;
        }>
    );

    const out = await refineHeroPrompt({
      brandName: "Wingo",
      currentPrompt: "A person.",
      history: [],
      userMessage: "Mach sie freundlicher.",
      llm,
    });

    expect(out.rationale).toBe(VALID.rationale);
    expect(out.prompt).toBe(VALID.prompt);
  });

  it("includes selectedReferenceUrl in referenceUrls when provided, [] otherwise", async () => {
    const llm = vi.fn(
      async (_opts: ClaudeCallOptions) =>
        fakeResponse(VALID) as ClaudeResponse<{
          rationale: string;
          prompt: string;
        }>
    );

    const withRef = await refineHeroPrompt({
      brandName: "Wingo",
      currentPrompt: "A person.",
      history: [],
      userMessage: "Mehr Energie.",
      selectedReferenceUrl: "memory://candidates/2.png",
      llm,
    });
    expect(withRef.referenceUrls).toEqual(["memory://candidates/2.png"]);

    const withoutRef = await refineHeroPrompt({
      brandName: "Wingo",
      currentPrompt: "A person.",
      history: [],
      userMessage: "Mehr Energie.",
      llm,
    });
    expect(withoutRef.referenceUrls).toEqual([]);
  });

  it("renders the prior history into the user message", async () => {
    const llm = vi.fn(
      async (_opts: ClaudeCallOptions) =>
        fakeResponse(VALID) as ClaudeResponse<{
          rationale: string;
          prompt: string;
        }>
    );

    await refineHeroPrompt({
      brandName: "Wingo",
      currentPrompt: "A person.",
      history: [
        { role: "user", content: "Bitte mehr Lifestyle." },
        { role: "assistant", content: "Verstanden, urbaner Look." },
      ],
      userMessage: "Jetzt mit Smartphone.",
      llm,
    });

    const opts = llm.mock.calls[0][0];
    // Der bisherige Dialog muss in der User-Message landen.
    expect(opts.userMessage).toContain("Bitte mehr Lifestyle.");
    expect(opts.userMessage).toContain("Verstanden, urbaner Look.");
    // Aktuelles Feedback ebenfalls.
    expect(opts.userMessage).toContain("Jetzt mit Smartphone.");
  });

  it("system prompt forbids baked-in text/logos and names the brand", async () => {
    const llm = vi.fn(
      async (_opts: ClaudeCallOptions) =>
        fakeResponse(VALID) as ClaudeResponse<{
          rationale: string;
          prompt: string;
        }>
    );

    await refineHeroPrompt({
      brandName: "Wingo",
      currentPrompt: "A person.",
      history: [],
      userMessage: "Schoener.",
      llm,
    });

    const sys = llm.mock.calls[0][0].systemPrompt;
    // Marke wird benannt (Brand-Style-Konsistenz).
    expect(sys).toContain("Wingo");
    // Verbot: kein/no + text/logo darf nicht ins Bild gebacken werden.
    expect(sys).toMatch(/kein|no/i);
    expect(sys).toMatch(/text|logo/i);
    // Freigestellte (transparente) Person ist Pflicht-Vorgabe.
    expect(sys).toMatch(/freigestellt|transparent/i);
  });

  it("throws when the llm output is missing the prompt field", async () => {
    const llm = vi.fn(
      async (_opts: ClaudeCallOptions) =>
        fakeResponse({ rationale: "nur Begruendung" }) as ClaudeResponse<{
          rationale: string;
          prompt: string;
        }>
    );

    await expect(
      refineHeroPrompt({
        brandName: "Wingo",
        currentPrompt: "A person.",
        history: [],
        userMessage: "Schoener.",
        llm,
      })
    ).rejects.toThrow(/ungueltig|invalid|struktur/i);
  });
});
