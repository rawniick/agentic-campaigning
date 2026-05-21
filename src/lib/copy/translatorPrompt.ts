import type { CopyTriple } from "./translateCampaignCopy";

export interface TranslatorPromptInput {
  sourceCopy: CopyTriple;
  passthroughTerms: string[];
}

export interface TranslatorPrompt {
  systemPrompt: string;
  userMessage: string;
}

// System-Prompt fuer Claude Batch-Translation. Strikte Compliance:
//   - Passthrough-Terms aus Glossar bleiben unveraendert.
//   - Preise und Disclaimer werden NICHT von Claude angefasst (kommen nicht ins Prompt).
//   - Output: ein einziges JSON-Objekt mit fr/it/en als Top-Level-Keys.
export function buildTranslatorPrompt(input: TranslatorPromptInput): TranslatorPrompt {
  const termList = input.passthroughTerms.map((t) => `- "${t}"`).join("\n");

  const systemPrompt = `Du bist ein Senior-Translator fuer Wingo Marketing-Kampagnen.

# Aufgabe
Uebersetze die deutsche Werbe-Copy parallel in Franzoesisch (fr), Italienisch (it) und Englisch (en).

# Passthrough-Glossar (UNVERAENDERT in jeder Sprache)
Die folgenden Wingo-Markennamen und -Phrasen bleiben in JEDER Zielsprache identisch zum Deutschen:
${termList}

# Strikte Compliance-Regeln
- Preise tauchen in dieser Aufgabe NICHT auf. Du sollst keine Preise erfinden oder uebersetzen.
- Disclaimer-Texte tauchen in dieser Aufgabe NICHT auf. Sie werden technisch eingefuegt, NICHT uebersetzt.
- Tone of Voice der DE-Vorlage in alle Zielsprachen uebertragen (gleicher Ton, gleiche Direktheit, gleiche Du/Tu-Anrede wo sinnvoll).
- Headline-Laengen aehnlich halten (max. 60 Zeichen).
- Subline 80-120 Zeichen.
- CTA max. 20 Zeichen.

# Output
Strikt JSON, kein Markdown, exakt diese Struktur:

{
  "fr": { "headlines": ["...","...","..."], "subline": "...", "cta_label": "..." },
  "it": { "headlines": ["...","...","..."], "subline": "...", "cta_label": "..." },
  "en": { "headlines": ["...","...","..."], "subline": "...", "cta_label": "..." }
}`;

  const userMessage = `DE-Quelle (zu uebersetzen):\n\n${JSON.stringify(input.sourceCopy, null, 2)}`;

  return { systemPrompt, userMessage };
}
