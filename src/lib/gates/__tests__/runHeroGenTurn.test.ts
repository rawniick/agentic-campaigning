import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createCampaign } from "../../db/queries/campaigns";
import { createInMemoryStorage } from "../../storage/inMemoryStorage";
import { createMockImageProvider } from "../../imagegen/mockImageProvider";
import { getGateChat } from "../../db/queries/gate-chat";
import { runHeroGenTurn } from "../runHeroGenTurn";
import type { ClaudeCallOptions, ClaudeResponse } from "../../ai/claude";
import type { ImageProvider, GenerateInput } from "../../imagegen/types";
import type { Brief } from "../../schemas/brief";

const BRIEF: Brief = {
  kampagne: {
    name: "Test",
    art: "flash_sale",
    datum_von: "2026-05-22",
    datum_bis: "2026-05-28",
    produkt_kategorie: "mobile",
  },
  produkt: { name: "Wingo Mobile Swiss", preis_promo: 19.95, preis_suffix: "/Mt." },
  strategie: { input: "x" },
  vermarktung: {
    hauptbotschaft: "x",
    zielgruppe: "sozial",
    zielgebiet: "deutschschweiz",
  },
  assets_kanaele: { channel_kategorien: [], format_codes: ["dv360_halfpage"] },
  sonstiges: {},
};

// Lade-Stub: mock-Provider liefert keine Bytes, also wird fetchBytes genutzt.
const fakeFetchBytes = async (url: string) => Buffer.from("img-" + url);

// Fake-LLM fuer die Iteration: liefert eine verfeinerte Prompt-Struktur.
function fakeRefineLlm(prompt: string, rationale = "Heller, mehr Sommer.") {
  return vi.fn(
    async (
      _opts: ClaudeCallOptions
    ): Promise<ClaudeResponse<{ rationale: string; prompt: string }>> => ({
      data: { rationale, prompt },
      rawText: "",
      tokensUsed: { input: 1, output: 1, total: 2 },
      model: "test",
      stopReason: "end_turn",
    })
  );
}

describe("runHeroGenTurn (Gate 2 — Hero-Gen Chat-Turn)", () => {
  let db: PGlite;
  let wingoId: string;
  let campaignId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const r = await db.query<{ id: string }>(
      `SELECT id FROM brands WHERE slug = 'wingo'`
    );
    wingoId = r.rows[0].id;
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM gate_chat`);
    await db.query(`DELETE FROM campaign_hero`);
    await db.query(`DELETE FROM campaign_copy`);
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);
    const c = await createCampaign(db, { brand_id: wingoId, brief: BRIEF });
    campaignId = c.id;
    await db.query(`UPDATE campaigns SET status = 'hero_pending' WHERE id = $1`, [
      campaignId,
    ]);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("first generation: persists user+assistant turns and returns n candidates from basePrompt", async () => {
    const result = await runHeroGenTurn(
      db,
      createInMemoryStorage(),
      createMockImageProvider(),
      {
        campaignId,
        brandSlug: "wingo",
        brandName: "Wingo",
        basePrompt: "freigestellte Familie am See",
        referenceUrls: ["memory://ref1.png"],
        n: 3,
      },
      fakeFetchBytes
    );

    expect(result.prompt).toBe("freigestellte Familie am See");
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates[0].storage_url.startsWith("memory://")).toBe(true);

    const turns = await getGateChat(db, campaignId, "hero", "de");
    expect(turns.map((t) => t.role)).toEqual(["user", "assistant"]);
    // Assistant-Turn speichert prompt + images -> Re-Open kann den Prompt wiederherstellen.
    const asst = turns[1].candidates as unknown as {
      prompt: string;
      images: unknown[];
    };
    expect(asst.prompt).toBe("freigestellte Familie am See");
    expect(asst.images).toHaveLength(3);
  });

  it("iteration: refines the prompt via the injected llm and uses it for generation", async () => {
    const llm = fakeRefineLlm("freigestellte Familie am See, goldenes Licht");
    const result = await runHeroGenTurn(
      db,
      createInMemoryStorage(),
      createMockImageProvider(),
      {
        campaignId,
        brandSlug: "wingo",
        brandName: "Wingo",
        currentPrompt: "freigestellte Familie am See",
        userMessage: "mehr Sommerstimmung",
        n: 2,
        llm,
      },
      fakeFetchBytes
    );

    expect(llm).toHaveBeenCalledOnce();
    expect(result.prompt).toBe("freigestellte Familie am See, goldenes Licht");
    expect(result.rationale).toBe("Heller, mehr Sommer.");
    expect(result.candidates).toHaveLength(2);

    const turns = await getGateChat(db, campaignId, "hero", "de");
    expect(turns).toHaveLength(2);
    expect(turns[0].content).toBe("mehr Sommerstimmung");
    expect(turns[1].content).toBe("Heller, mehr Sommer.");
  });

  it("iteration forwards the selected variant as an extra style reference into generation", async () => {
    let seen: GenerateInput | null = null;
    const spyProvider: ImageProvider = {
      name: "spy",
      async generate(_model, input) {
        seen = input;
        return [{ url: "mock://x.png", contentType: "image/png" }];
      },
    };
    await runHeroGenTurn(
      db,
      createInMemoryStorage(),
      spyProvider,
      {
        campaignId,
        brandSlug: "wingo",
        brandName: "Wingo",
        currentPrompt: "base",
        userMessage: "so wie Variante 2",
        selectedReferenceUrl: "memory://chosen.png",
        referenceUrls: ["memory://comp1.png"],
        n: 1,
        llm: fakeRefineLlm("base verfeinert"),
      },
      fakeFetchBytes
    );

    expect(seen).not.toBeNull();
    expect(seen!.styleReferenceUrls).toContain("memory://chosen.png");
    expect(seen!.styleReferenceUrls).toContain("memory://comp1.png");
  });

  it("rejects iteration without an llm", async () => {
    await expect(
      runHeroGenTurn(
        db,
        createInMemoryStorage(),
        createMockImageProvider(),
        {
          campaignId,
          brandSlug: "wingo",
          brandName: "Wingo",
          currentPrompt: "base",
          userMessage: "anders",
        },
        fakeFetchBytes
      )
    ).rejects.toThrow(/llm/i);
  });

  it("rejects first generation without a basePrompt", async () => {
    await expect(
      runHeroGenTurn(
        db,
        createInMemoryStorage(),
        createMockImageProvider(),
        { campaignId, brandSlug: "wingo", brandName: "Wingo" },
        fakeFetchBytes
      )
    ).rejects.toThrow(/prompt/i);
  });
});
