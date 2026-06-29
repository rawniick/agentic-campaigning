import { z } from "zod";
import { parseJsonResponse } from "../ai/claude";
import type { VisionLLMFn } from "./claudeVisionClient";

// QA-Loop fuer generierte Heroes: bewertet einen Kandidaten auf Marken-Stil-
// Konsistenz via Claude Vision. Die Vision-Funktion ist injizierbar (DI), damit
// Tests ohne echten API-Call laufen.

export interface HeroStyleQAInput {
  imageUrl: string;
  brandStyleNotes: string;
  vision: VisionLLMFn;
  threshold?: number;
}

export interface HeroStyleQAResult {
  score: number;
  issues: string[];
  pass: boolean;
}

// Standard-Schwelle: darunter gilt der Hero als stilistisch nicht brand-konform
// und muss neu generiert werden (QA-Loop).
const DEFAULT_THRESHOLD = 0.7;

const VisionStyleSchema = z.object({
  score: z.number().min(0).max(1),
  // Modell laesst issues bei makellosem Hero oft weg -> leeres Array als Default.
  issues: z.array(z.string()).default([]),
});

const SYSTEM_PROMPT = `Du bist ein strenger Brand-Stil-Pruefer fuer Wingo-Hero-Bilder.
Du bewertest, wie gut ein generiertes Hero-Bild zum vorgegebenen Marken-Stil passt
(Farbwelt, Bildsprache, Stimmung, Look-and-Feel), auf einer Skala von 0.0 (voellig
fremd) bis 1.0 (perfekt stimmig).

Antworte STRIKT als JSON, kein Markdown:
{ "score": 0.0, "issues": ["kurzer Hinweis je Abweichung"] }`;

// Style-Notes in den User-Text einbetten — die Vision-Funktion erhaelt zusaetzlich
// die Bildreferenz (imageBase64) als reine Passthrough-Information.
function buildUserText(brandStyleNotes: string): string {
  return (
    `Bewerte die Stil-Konsistenz dieses Hero-Bildes gegen folgende Marken-Stil-Vorgaben:\n\n` +
    `${brandStyleNotes}\n\n` +
    `Gib das JSON gemaess System-Prompt zurueck.`
  );
}

export async function scoreHeroStyle(
  input: HeroStyleQAInput
): Promise<HeroStyleQAResult> {
  const rawText = await input.vision({
    systemPrompt: SYSTEM_PROMPT,
    userText: buildUserText(input.brandStyleNotes),
    imageBase64: input.imageUrl,
    imageMediaType: "image/png",
  });

  const parsed = VisionStyleSchema.parse(parseJsonResponse(rawText));

  const threshold = input.threshold ?? DEFAULT_THRESHOLD;

  return {
    score: parsed.score,
    issues: parsed.issues,
    pass: parsed.score >= threshold,
  };
}
