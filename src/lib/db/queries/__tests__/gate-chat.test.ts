import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../__tests__/fixtures/createTestDb";
import { createCampaign } from "../campaigns";
import { getGateChat, appendGateChatTurn } from "../gate-chat";
import type { Brief } from "../../../schemas/brief";
import type { CopyOutput } from "../../../copy/generateCopy";

const VALID_BRIEF: Brief = {
  kampagne: {
    name: "Wingo Mobile Swiss — Flash Sale",
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
  strategie: { input: "Marktreaktion auf Salt-Preissenkung" },
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

const CANDIDATES: CopyOutput = {
  headlines: ["Halber Preis, ganzes Netz", "Jetzt zugreifen", "Wingo Flash"],
  subline: "Schweizer Qualität zum Aktionspreis — nur für kurze Zeit.",
  cta_label: "Jetzt sichern",
};

describe("gate-chat queries", () => {
  let db: PGlite;
  let campaignId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const brandRes = await db.query<{ id: string }>(
      `SELECT id FROM brands WHERE slug = 'wingo'`
    );
    const campaign = await createCampaign(db, {
      brand_id: brandRes.rows[0].id,
      brief: VALID_BRIEF,
    });
    campaignId = campaign.id;
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("append user + assistant turns and read them back in ASC order with parsed candidates", async () => {
    // User-Turn: Feedback ohne candidates
    const userTurn = await appendGateChatTurn(db, {
      campaignId,
      gate: "copy",
      language: "de",
      role: "user",
      content: "Mach die Headlines kürzer und knackiger.",
    });
    expect(userTurn.role).toBe("user");
    expect(userTurn.candidates).toBeNull();

    // Assistant-Turn: Begruendung + erzeugtes CopyOutput-Set als jsonb
    const assistantTurn = await appendGateChatTurn(db, {
      campaignId,
      gate: "copy",
      language: "de",
      role: "assistant",
      content: "Headlines auf maximal drei Wörter verdichtet.",
      candidates: CANDIDATES,
    });
    expect(assistantTurn.role).toBe("assistant");
    expect(assistantTurn.candidates).toEqual(CANDIDATES);

    const history = await getGateChat(db, campaignId, "copy", "de");
    expect(history).toHaveLength(2);

    // ASC-Reihenfolge: User zuerst, Assistant danach
    expect(history[0].role).toBe("user");
    expect(history[0].candidates).toBeNull();
    expect(history[1].role).toBe("assistant");

    // candidates ist als CopyOutput geparst (Objekt, kein String)
    expect(history[1].candidates).not.toBeNull();
    expect(history[1].candidates).toEqual(CANDIDATES);
    expect(history[1].candidates?.headlines).toHaveLength(3);
    expect(history[1].candidates?.cta_label).toBe("Jetzt sichern");
  });

  it("scopes by gate and language", async () => {
    // Anderes Gate / andere Sprache darf nicht in den 'copy'/'de'-Verlauf lecken
    await appendGateChatTurn(db, {
      campaignId,
      gate: "hero",
      language: "de",
      role: "user",
      content: "Anderes Gate.",
    });
    await appendGateChatTurn(db, {
      campaignId,
      gate: "copy",
      language: "fr",
      role: "user",
      content: "Autre langue.",
    });

    const copyDe = await getGateChat(db, campaignId, "copy", "de");
    expect(copyDe.every((t) => t.gate === "copy" && t.language === "de")).toBe(
      true
    );
    expect(copyDe).toHaveLength(2);
  });
});
