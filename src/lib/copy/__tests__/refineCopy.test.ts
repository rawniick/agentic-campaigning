import { describe, it, expect, vi } from "vitest";
import { refineCopy } from "../refineCopy";
import type { CopyOutput } from "../generateCopy";
import type { Brief } from "../../schemas/brief";

const VALID_BRIEF: Brief = {
  kampagne: {
    name: "Wingo Mobile Swiss — Flash Sale Test",
    art: "flash_sale",
    datum_von: "2026-05-22",
    datum_bis: "2026-05-28",
    produkt_kategorie: "mobile",
  },
  produkt: {
    name: "Wingo Mobile Swiss",
    preis_promo: 19.95,
    preis_standard: 29.95,
    preis_suffix: "/Mt.",
  },
  strategie: { input: "Reaktion auf Salt-Preissenkung" },
  vermarktung: {
    hauptbotschaft: "Schweizer Netz, halber Preis.",
    zielgruppe: "sozial",
    zielgebiet: "deutschschweiz",
  },
  assets_kanaele: {
    channel_kategorien: ["Display Standard"],
    format_codes: ["dv360_halfpage"],
  },
  sonstiges: {},
};

const CURRENT: CopyOutput = {
  headlines: ["Alt A", "Alt B", "Alt C"],
  subline: "Alte Subline",
  cta_label: "Jetzt",
};

const TOV_MD = "# Wingo Default Voice\n- Direkt, klar, schweizerisch.\n- Du-Form.";

function mockLlm(
  data: {
    rationale: string;
    headlines: string[];
    subline: string;
    cta_label: string;
  } = {
    rationale: "Headlines dringlicher gemacht.",
    headlines: ["Neu A", "Neu B", "Neu C"],
    subline: "Neue Subline",
    cta_label: "Sichern",
  }
) {
  return vi.fn().mockResolvedValueOnce({
    data,
    rawText: "{}",
    tokensUsed: { input: 100, output: 80, total: 180 },
    model: "claude-sonnet-4-6",
    stopReason: "end_turn",
  });
}

describe("refineCopy", () => {
  it("maps the LLM output onto RefineResult (rationale + candidates)", async () => {
    const llm = mockLlm();

    const result = await refineCopy({
      brief: VALID_BRIEF,
      tovMd: TOV_MD,
      passthroughTerms: ["Wingo Mobile Swiss"],
      current: CURRENT,
      history: [],
      userMessage: "Mach es dringlicher.",
      language: "de",
      llm,
    });

    expect(llm).toHaveBeenCalledOnce();
    expect(result.rationale).toBe("Headlines dringlicher gemacht.");
    expect(result.candidates).toEqual({
      headlines: ["Neu A", "Neu B", "Neu C"],
      subline: "Neue Subline",
      cta_label: "Sichern",
    });
  });

  it("instruiert die Compliance-Regeln im System-Prompt (keine Preise/Disclaimer erfinden)", async () => {
    const llm = mockLlm();

    await refineCopy({
      brief: VALID_BRIEF,
      tovMd: TOV_MD,
      passthroughTerms: ["Wingo Mobile Swiss"],
      current: CURRENT,
      history: [],
      userMessage: "Verfeinere die Headlines.",
      language: "de",
      llm,
    });

    const { systemPrompt } = llm.mock.calls[0][0];
    expect(systemPrompt).toContain("Compliance");
    expect(systemPrompt).toContain("ERFINDE KEINE PREISE");
    expect(systemPrompt).toContain("ERFINDE KEINE LEGAL-TEXTE");
  });

  it("instruiert korrekte Orthografie + verbietet ASCII-Transliteration im System-Prompt", async () => {
    const llm = mockLlm();

    await refineCopy({
      brief: VALID_BRIEF,
      tovMd: TOV_MD,
      passthroughTerms: ["Wingo Mobile Swiss"],
      current: CURRENT,
      history: [],
      userMessage: "Verfeinere die Headlines.",
      language: "de",
      llm,
    });

    const { systemPrompt } = llm.mock.calls[0][0];
    // Explizite Regel + echte Umlaute im Prompt (kein ae/oe/ue).
    expect(systemPrompt).toContain("Orthografie");
    expect(systemPrompt).toContain("ä ö ü");
    expect(systemPrompt).toContain("für");
    expect(systemPrompt).not.toContain("uebersetzen");
  });

  it("haelt das Glossar (passthrough terms) im System-Prompt unveraendert", async () => {
    const llm = mockLlm();

    await refineCopy({
      brief: VALID_BRIEF,
      tovMd: TOV_MD,
      passthroughTerms: ["Wingo Mobile Swiss", "5G im Swisscom Netz"],
      current: CURRENT,
      history: [],
      userMessage: "Verfeinere die Headlines.",
      language: "de",
      llm,
    });

    const { systemPrompt } = llm.mock.calls[0][0];
    expect(systemPrompt).toContain("Glossar");
    expect(systemPrompt).toContain("Wingo Mobile Swiss");
    expect(systemPrompt).toContain("5G im Swisscom Netz");
  });

  it("sendet aktuellen Stand, History und neues Feedback in der userMessage an die LLM", async () => {
    const llm = mockLlm();

    await refineCopy({
      brief: VALID_BRIEF,
      tovMd: TOV_MD,
      passthroughTerms: ["Wingo Mobile Swiss"],
      current: CURRENT,
      history: [
        { role: "user", content: "Erstes Feedback" },
        { role: "assistant", content: "Erste Begruendung" },
      ],
      userMessage: "Zweites Feedback",
      language: "de",
      llm,
    });

    const { userMessage } = llm.mock.calls[0][0];
    // Aktueller Kandidaten-Stand
    expect(userMessage).toContain("Alt A");
    expect(userMessage).toContain("Alte Subline");
    // Bisheriger Dialog
    expect(userMessage).toContain("Erstes Feedback");
    expect(userMessage).toContain("Erste Begruendung");
    // Neues Feedback
    expect(userMessage).toContain("Zweites Feedback");
  });

  it("sendet niemals Preise/Konditionen an die LLM (pass-through compliance)", async () => {
    const briefWithKonditionen: Brief = {
      ...VALID_BRIEF,
      produkt: {
        ...VALID_BRIEF.produkt,
        konditionen: "Aktionspreis 9.95 fuer 12 Monate, danach 29.95/Mt.",
      },
    };
    const llm = mockLlm();

    await refineCopy({
      brief: briefWithKonditionen,
      tovMd: TOV_MD,
      passthroughTerms: ["Wingo Mobile Swiss"],
      current: CURRENT,
      history: [],
      userMessage: "Verfeinere die Headlines.",
      language: "de",
      llm,
    });

    const { systemPrompt, userMessage } = llm.mock.calls[0][0];
    const full = `${systemPrompt}\n${userMessage}`;
    expect(full).not.toContain("9.95");
    expect(full).not.toMatch(/19\.95/);
    expect(full).not.toContain("Aktionspreis");
  });
});
