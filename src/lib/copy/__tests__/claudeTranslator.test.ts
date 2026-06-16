import { describe, it, expect, vi } from "vitest";
import { createClaudeTranslator } from "../claudeTranslator";
import type { ClaudeCallOptions, ClaudeResponse } from "../../ai/claude";

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
  fr: { headlines: ["a", "b", "c"], subline: "s-fr", cta_label: "c-fr" },
  it: { headlines: ["a", "b", "c"], subline: "s-it", cta_label: "c-it" },
  en: { headlines: ["a", "b", "c"], subline: "s-en", cta_label: "c-en" },
};

describe("createClaudeTranslator", () => {
  it("builds the translator prompt with passthrough terms and returns parsed translations", async () => {
    const claudeFn = vi.fn(
      async (_opts: ClaudeCallOptions) => fakeResponse(VALID)
    );
    const translate = createClaudeTranslator(claudeFn);

    const out = await translate({
      sourceCopy: { headlines: ["Headline-DE"], subline: "S", cta_label: "C" },
      passthroughTerms: ["Wingo", "5G im Swisscom Netz"],
    });

    expect(out).toEqual(VALID);
    expect(claudeFn).toHaveBeenCalledTimes(1);
    const opts = claudeFn.mock.calls[0][0];
    // Passthrough-Terms landen im System-Prompt, DE-Quelle in der User-Message.
    expect(opts.systemPrompt).toContain("5G im Swisscom Netz");
    expect(opts.userMessage).toContain("Headline-DE");
    // Niedrige Temperatur fuer treue Uebersetzung.
    expect(opts.temperature).toBe(0.3);
  });

  it("throws when the LLM returns an invalid shape", async () => {
    const claudeFn = vi.fn(
      async (_opts: ClaudeCallOptions) =>
        fakeResponse({ fr: { headlines: ["a"] } })
    );
    const translate = createClaudeTranslator(claudeFn);

    await expect(
      translate({
        sourceCopy: { headlines: ["H"], subline: "S", cta_label: "C" },
        passthroughTerms: [],
      })
    ).rejects.toThrow(/ungueltige Struktur/);
  });
});
