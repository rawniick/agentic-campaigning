import type { Db } from "../db/types";
import type { Brief } from "../schemas/brief";
import type { BrandConfig } from "../brand/loadBrand";
import type { Disclaimer } from "../db/queries/disclaimers";
import type { ClaudeCallOptions, ClaudeResponse } from "../ai/claude";
import { findVoiceVariant, type BrandVoice } from "../db/queries/brand-voice";

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

export interface GenerateCopyResult extends CampaignCopy {
  // Welche TOV-Variante (Matrix-Zelle oder Default) verwendet wurde — fuer Audit-Log.
  voiceVariant: BrandVoice;
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
// `konditionen` ist BEWUSST ausgeschlossen — Freitext, der Preise/Vertrags-Werte
// enthalten kann (die gehoeren in Preis-Felder + Disclaimer, nie in die Creative-Copy).
function buildBriefContext(brief: Brief): Record<string, unknown> {
  return {
    kampagne_art: brief.kampagne.art,
    produkt_kategorie: brief.kampagne.produkt_kategorie,
    produkt_name: brief.produkt.name,
    strategie: brief.strategie.input,
    hauptbotschaft: brief.vermarktung.hauptbotschaft,
    nebenbotschaft: brief.vermarktung.nebenbotschaft,
    zielgruppe: brief.vermarktung.zielgruppe,
    zielgebiet: brief.vermarktung.zielgebiet,
  };
}

function buildSystemPrompt(
  brandConfig: BrandConfig,
  language: string,
  tovMd: string
): string {
  const termList =
    brandConfig.glossar.passthrough_terms.map((t) => `- "${t}"`).join("\n") ||
    "- (keine)";

  return `Du bist ein Senior-Copywriter für ${brandConfig.brand.name}.

# Tone of Voice (Pflicht)

${tovMd}

# Glossar (UNVERÄNDERT — niemals paraphrasieren oder übersetzen)

Die folgenden Wingo-Markennamen/-Phrasen bleiben exakt identisch:
${termList}

# Aufgabe

Erzeuge für eine Werbe-Kampagne in Sprache ${language.toUpperCase()}:
- 3 Headlines (jeweils max. 60 Zeichen, eine pro Variante)
- 1 Subline (ca. 80-120 Zeichen)
- 1 CTA-Label (max. 20 Zeichen, action-oriented)

# Sprache & Orthografie (Pflicht)

- Schreibe in korrekter, natürlicher Orthografie der Zielsprache ${language.toUpperCase()}.
- Verwende IMMER die echten Sonderzeichen der Sprache: Deutsch ä ö ü Ä Ö Ü ß;
  Französisch/Italienisch à é è ê ë î ï ô ù û ç ò ì etc.
- NIEMALS ASCII-Transliteration: keine Buchstabenpaare statt Umlaut (also nicht
  "ae/oe/ue/ss" für ä/ö/ü/ß), keine nackten Vokale statt Akzent.
  Korrekt z.B.: "für", "grösser", "Geschäft", "Qualität".

# Strikte Compliance-Regeln

- ERFINDE KEINE PREISE. Sie werden technisch von der Engine eingefügt.
- ERFINDE KEINE LEGAL-TEXTE / DISCLAIMER. Diese werden technisch eingefügt.
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
): Promise<GenerateCopyResult> {
  // TOV-Matrix: spezifische Zelle (Kampagnen-Art x Zielgruppe) schlaegt den
  // Brand-Default. findVoiceVariant faellt auf is_default zurueck, wenn keine
  // Zelle existiert.
  const voiceVariant = await findVoiceVariant(
    db,
    input.brandConfig.brand.id,
    input.brief.kampagne.art,
    input.brief.vermarktung.zielgruppe
  );

  const systemPrompt = buildSystemPrompt(
    input.brandConfig,
    input.language,
    voiceVariant.tov_md
  );
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
    voiceVariant,
  };
}
