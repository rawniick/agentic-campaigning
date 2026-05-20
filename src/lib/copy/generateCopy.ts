import type { Db } from "../db/types";
import type { Brief } from "../schemas/brief";
import type { BrandConfig } from "../brand/loadBrand";
import type { Disclaimer } from "../db/queries/disclaimers";
import type { ClaudeCallOptions, ClaudeResponse } from "../ai/claude";

export interface CopyOutput {
  headlines: string[];
  subline: string;
  cta_label: string;
}

export interface CampaignCopy extends CopyOutput {
  id: string;
  campaign_id: string;
  language: string;
  disclaimer_ids: string[];
}

export interface GenerateCopyInput {
  campaignId: string;
  brief: Brief;
  brandConfig: BrandConfig;
  language: string;
  disclaimers: Disclaimer[];
  llm: (opts: ClaudeCallOptions) => Promise<ClaudeResponse<CopyOutput>>;
}

// Compliance: Preise und Disclaimer-Texte werden NIE an die LLM gesendet.
// Der Brief, der ins userMessage geht, ist eine bewusste Reduktion: nur
// kommunikationsrelevanter Kontext, keine pass-through-Werte.
function buildBriefContext(brief: Brief): Record<string, unknown> {
  return {
    kampagne_art: brief.kampagne.art,
    produkt_kategorie: brief.kampagne.produkt_kategorie,
    produkt_name: brief.produkt.name,
    konditionen: brief.produkt.konditionen,
    strategie: brief.strategie.input,
    hauptbotschaft: brief.vermarktung.hauptbotschaft,
    nebenbotschaft: brief.vermarktung.nebenbotschaft,
    zielgruppe: brief.vermarktung.zielgruppe,
    zielgebiet: brief.vermarktung.zielgebiet,
  };
}

function buildSystemPrompt(brandConfig: BrandConfig, language: string): string {
  return `Du bist ein Senior-Copywriter fuer ${brandConfig.brand.name}.

# Tone of Voice (Pflicht)

${brandConfig.defaultVoice.tov_md}

# Glossar

Wingo-Markennamen bleiben unveraendert in jeder Sprache.

# Aufgabe

Erzeuge fuer eine Werbe-Kampagne in Sprache ${language.toUpperCase()}:
- 3 Headlines (jeweils max. 60 Zeichen, eine pro Variante)
- 1 Subline (ca. 80-120 Zeichen)
- 1 CTA-Label (max. 20 Zeichen, action-oriented)

# Strikte Compliance-Regeln

- ERFINDE KEINE PREISE. Sie werden technisch von der Engine eingefuegt.
- ERFINDE KEINE LEGAL-TEXTE / DISCLAIMER. Diese werden technisch eingefuegt.
- KEINE PRODUKTVERSPRECHEN die nicht im Brief stehen.

# Output

Strikt JSON, kein Markdown, exakt diese Struktur:

{
  "headlines": ["string", "string", "string"],
  "subline": "string",
  "cta_label": "string"
}`;
}

function buildUserMessage(brief: Brief): string {
  return `Brief-Kontext (JSON):\n\n${JSON.stringify(buildBriefContext(brief), null, 2)}`;
}

export async function generateCopy(
  db: Db,
  input: GenerateCopyInput
): Promise<CampaignCopy> {
  const systemPrompt = buildSystemPrompt(input.brandConfig, input.language);
  const userMessage = buildUserMessage(input.brief);

  const response = await input.llm({
    systemPrompt,
    userMessage,
    temperature: 0.7,
    maxTokens: 1024,
  });

  const { headlines, subline, cta_label } = response.data;
  const disclaimerIds = input.disclaimers.map((d) => d.id);

  const insertRes = await db.query<Record<string, unknown>>(
    `INSERT INTO campaign_copy
       (campaign_id, language, headlines, subline, cta_label, disclaimer_ids,
        llm_model, llm_tokens_in, llm_tokens_out)
       VALUES ($1, $2, $3, $4, $5, $6::uuid[], $7, $8, $9)
       RETURNING *`,
    [
      input.campaignId,
      input.language,
      headlines,
      subline,
      cta_label,
      disclaimerIds,
      response.model,
      response.tokensUsed.input,
      response.tokensUsed.output,
    ]
  );

  const row = insertRes.rows[0] as unknown as CampaignCopy;
  return {
    id: row.id,
    campaign_id: row.campaign_id,
    language: row.language,
    headlines: row.headlines,
    subline: row.subline,
    cta_label: row.cta_label,
    disclaimer_ids: row.disclaimer_ids ?? [],
  };
}
