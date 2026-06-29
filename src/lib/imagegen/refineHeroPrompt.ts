import { z } from "zod";
import type { ClaudeCallOptions, ClaudeResponse } from "../ai/claude";

// Schema fuer den LLM-Output: beide Felder Pflicht und nicht-leer.
const refineHeroOutputSchema = z.object({
  rationale: z.string().min(1),
  prompt: z.string().min(1),
});

export interface RefineHeroPromptInput {
  brandName: string;
  currentPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
  selectedReferenceUrl?: string;
  llm: (
    opts: ClaudeCallOptions
  ) => Promise<ClaudeResponse<{ rationale: string; prompt: string }>>;
}

export interface RefineHeroPromptResult {
  rationale: string;
  prompt: string;
  referenceUrls: string[];
}

function buildSystemPrompt(brandName: string): string {
  // System-Prompt fuer die Hero-Bild-Iteration (Gate 2). Zentrale Vorgaben:
  // - freigestellte (transparenter Hintergrund) Person/Personen, randlos (bleed)
  // - photoreal, Brand-Style-Konsistenz
  // - KEIN Text/Logo/Wort ins Bild gebacken — Wingo-Chrome (Logo, Headline,
  //   Preis) wird SPAETER vom Template komponiert, nie vom Bild-Modell.
  return `Du bist Art-Director fuer markenkonforme Kampagnen-Hero-Bilder von ${brandName}.

# Aufgabe

Aus dem bisherigen Dialog, dem aktuellen Bild-Prompt und dem neuen Marketer-Feedback
erzeugst du EINEN verbesserten Bild-Generierungs-Prompt (auf Englisch, fuer das
Bild-Modell) plus eine Ein-Satz-Begruendung auf Deutsch.

# Pflicht-Vorgaben fuer den Bild-Prompt

- Motiv ist eine FREIGESTELLTE Person/Personen vor transparentem Hintergrund
  (transparent background cut-out), die bis an den Bildrand reicht (bleed to the edge).
- Photoreal, hochwertig, markenkonform — halte den Brand-Style ueber alle Iterationen
  konsistent.
- KEIN Text, KEINE Logos, KEINE Worte ins Bild gebacken. Das Bild-Modell rendert
  NIEMALS Schrift. Das Wingo-Brand-Chrome (Logo, Headline, Preis) wird SPAETER vom
  Template darueber komponiert — nie vom Bild-Modell.
- Aendere nur, was das Feedback verlangt — was funktioniert, bleibt erhalten.

# Output

Strikt JSON, kein Markdown, exakt diese Struktur:

{
  "rationale": "1 Satz auf Deutsch, warum du so geaendert hast",
  "prompt": "der verbesserte englische Bild-Generierungs-Prompt"
}`;
}

function buildUserMessage(input: RefineHeroPromptInput): string {
  const parts: string[] = [];

  // Aktueller Bild-Prompt als Ausgangspunkt der Verfeinerung.
  parts.push(`Aktueller Bild-Prompt:\n\n${input.currentPrompt}`);

  if (input.selectedReferenceUrl) {
    // Die gewaehlte Variante dient als Style-Anker fuer die naechste Iteration.
    parts.push(
      `Gewaehlte Referenz-Variante (Style beibehalten):\n\n${input.selectedReferenceUrl}`
    );
  }

  if (input.history.length > 0) {
    const dialog = input.history
      .map(
        (turn) =>
          `${turn.role === "user" ? "Marketer" : "Bild-Direktor"}: ${turn.content}`
      )
      .join("\n");
    parts.push(`Bisheriger Dialog:\n\n${dialog}`);
  }

  parts.push(`Neues Feedback des Marketers:\n\n${input.userMessage}`);

  return parts.join("\n\n---\n\n");
}

// Verfeinert den Hero-Bild-Prompt anhand des bisherigen Dialogs + neuem Feedback.
// Reine Berechnung — kein DB-Zugriff (Persistenz uebernimmt die Chat-Action).
export async function refineHeroPrompt(
  input: RefineHeroPromptInput
): Promise<RefineHeroPromptResult> {
  const systemPrompt = buildSystemPrompt(input.brandName);
  const userMessage = buildUserMessage(input);

  const response = await input.llm({
    systemPrompt,
    userMessage,
    temperature: 0.7,
    maxTokens: 1024,
  });

  // LLM-Output strikt validieren — fehlt prompt/rationale, ist die Struktur ungueltig.
  const parsed = refineHeroOutputSchema.safeParse(response.data);
  if (!parsed.success) {
    throw new Error("LLM lieferte eine ungueltige Struktur fuer den Hero-Prompt");
  }
  const { rationale, prompt } = parsed.data;

  // Die gewaehlte Variante wird als zusaetzliche Style-Referenz fuer den
  // naechsten Generierungs-Turn zurueckgegeben (Brand-Style-Konsistenz).
  const referenceUrls = input.selectedReferenceUrl
    ? [input.selectedReferenceUrl]
    : [];

  return { rationale, prompt, referenceUrls };
}
