import type { Brief } from "../schemas/brief";
import type { ClaudeCallOptions, ClaudeResponse } from "../ai/claude";
import type { CopyOutput } from "./generateCopy";

// Ergebnis eines Refinement-Turns: eine Ein-Satz-Begruendung (rationale) plus
// das neue Kandidaten-Set (3 Headlines + Subline + CTA).
export interface RefineResult {
  rationale: string;
  candidates: CopyOutput;
}

export interface RefineCopyInput {
  brief: Brief;
  tovMd: string; // Brand-Voice (wie in generateCopy)
  passthroughTerms: string[]; // Glossar
  current: CopyOutput; // aktueller Kandidaten-Stand
  history: { role: "user" | "assistant"; content: string }[]; // bisheriger Dialog
  userMessage: string; // neues Feedback
  language: string;
  llm: (
    opts: ClaudeCallOptions
  ) => Promise<
    ClaudeResponse<{
      rationale: string;
      headlines: string[];
      subline: string;
      cta_label: string;
    }>
  >;
}

// Brief-Kontext fuer das Refinement: BEWUSST identische Reduktion wie in
// generateCopy.buildBriefContext — kommunikationsrelevant, KEINE pass-through-Werte
// (Preise/Konditionen gehoeren nie in die Creative-Copy / nie an die LLM).
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
  brandName: string,
  language: string,
  tovMd: string,
  passthroughTerms: string[]
): string {
  const termList =
    passthroughTerms.map((t) => `- "${t}"`).join("\n") || "- (keine)";

  // Bewusst dieselben Compliance- und Orthografie-Regeln wie generateCopy:
  // Refinement darf weder Preise/Disclaimer erfinden noch das Glossar veraendern,
  // und muss echte Umlaute/Akzente schreiben (keine ASCII-Transliteration).
  return `Du bist ein Senior-Copywriter für ${brandName}.

# Tone of Voice (Pflicht)

${tovMd}

# Glossar (UNVERÄNDERT — niemals paraphrasieren oder übersetzen)

Die folgenden Wingo-Markennamen/-Phrasen bleiben exakt identisch:
${termList}

# Aufgabe

Du verfeinerst eine bestehende Werbe-Copy in Sprache ${language.toUpperCase()}.
Dir liegen der aktuelle Stand (3 Headlines + 1 Subline + 1 CTA-Label) sowie das
neue Feedback des Marketers vor. Überarbeite die Copy gezielt gemäss dem Feedback:
- 3 Headlines (jeweils max. 60 Zeichen, eine pro Variante)
- 1 Subline (ca. 80-120 Zeichen)
- 1 CTA-Label (max. 20 Zeichen, action-oriented)

Ändere nur, was das Feedback verlangt — was funktioniert, bleibt erhalten.

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
  "rationale": "1 Satz, warum du so geändert hast",
  "headlines": ["string", "string", "string"],
  "subline": "string",
  "cta_label": "string"
}`;
}

function buildUserMessage(input: RefineCopyInput): string {
  const parts: string[] = [];

  parts.push(
    `Brief-Kontext (JSON):\n\n${JSON.stringify(
      buildBriefContext(input.brief),
      null,
      2
    )}`
  );

  parts.push(
    `Aktueller Kandidaten-Stand (JSON):\n\n${JSON.stringify(
      {
        headlines: input.current.headlines,
        subline: input.current.subline,
        cta_label: input.current.cta_label,
      },
      null,
      2
    )}`
  );

  if (input.history.length > 0) {
    const dialog = input.history
      .map(
        (turn) =>
          `${turn.role === "user" ? "Marketer" : "Copywriter"}: ${turn.content}`
      )
      .join("\n");
    parts.push(`Bisheriger Dialog:\n\n${dialog}`);
  }

  parts.push(`Neues Feedback des Marketers:\n\n${input.userMessage}`);

  return parts.join("\n\n---\n\n");
}

// Verfeinert die bestehenden 3 Headlines + Subline + CTA gemaess Marketer-Feedback.
// Reine Berechnung — kein DB-Zugriff (Persistenz uebernimmt die Chat-Action).
export async function refineCopy(input: RefineCopyInput): Promise<RefineResult> {
  const systemPrompt = buildSystemPrompt(
    "Wingo",
    input.language,
    input.tovMd,
    input.passthroughTerms
  );
  const userMessage = buildUserMessage(input);

  const response = await input.llm({
    systemPrompt,
    userMessage,
    temperature: 0.7,
    maxTokens: 1024,
  });

  const { rationale, headlines, subline, cta_label } = response.data;

  return {
    rationale,
    candidates: { headlines, subline, cta_label },
  };
}
