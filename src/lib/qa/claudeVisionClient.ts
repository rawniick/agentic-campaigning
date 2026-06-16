import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { parseJsonResponse } from "../ai/claude";
import type {
  VisionQAClient,
  VisionQAClientInput,
  VisionQAResult,
} from "./runVisionQA";

// Claude-Vision-Adapter fuer Vision-QA. callClaude ist text-only (kein
// Image-Support), daher hier ein eigener Pfad mit Image-Content-Block.
// Die LLM-Funktion ist injizierbar, damit Tests ohne echten API-Call laufen.

const MODEL = "claude-sonnet-4-6";

const SCORE = z.number().min(0).max(1);

const VisionResultSchema = z.object({
  checks: z.object({
    logo_bounds: SCORE,
    color_match: SCORE,
    safezone: SCORE,
    style_consistency: SCORE,
  }),
  notes: z.string().optional(),
});

const SUPPORTED_MEDIA = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;
type SupportedMedia = (typeof SUPPORTED_MEDIA)[number];

function narrowMedia(mime: string): SupportedMedia {
  return (SUPPORTED_MEDIA as readonly string[]).includes(mime)
    ? (mime as SupportedMedia)
    : "image/png";
}

const SYSTEM_PROMPT = `Du bist ein strenger Brand-Compliance-Pruefer fuer Wingo-Werbeassets.
Du bewertest ein gerendertes Asset gegen vier Achsen, jeweils 0.0 (grobe Verletzung)
bis 1.0 (perfekt brand-konform):
- logo_bounds: Logo unverzerrt, korrekte Proportionen, nicht beschnitten/ueberlappt
- color_match: Brand-Primaerfarbe korrekt verwendet, keine fremden/falschen Farben
- safezone: Pflicht-Schutzbereiche (Raender) eingehalten, nichts klebt am Rand
- style_consistency: stimmiger, professioneller Wingo-Look

Antworte STRIKT als JSON, kein Markdown:
{ "checks": { "logo_bounds": 0.0, "color_match": 0.0, "safezone": 0.0, "style_consistency": 0.0 }, "notes": "kurze Begruendung" }`;

function buildUserText(input: VisionQAClientInput): string {
  return (
    `Pruefe dieses Asset (Format-Code: ${input.formatCode}).\n` +
    `Erwartete Brand-Primaerfarbe: ${input.brandPrimaryHex}.\n` +
    `Bewerte die vier Achsen wie im System-Prompt beschrieben und gib das JSON zurueck.`
  );
}

export type VisionLLMFn = (req: {
  systemPrompt: string;
  userText: string;
  imageBase64: string;
  imageMediaType: string;
}) => Promise<string>;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY ist nicht gesetzt");
    client = new Anthropic({ apiKey });
  }
  return client;
}

const defaultVisionLLM: VisionLLMFn = async (req) => {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: req.systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: narrowMedia(req.imageMediaType),
              data: req.imageBase64,
            },
          },
          { type: "text", text: req.userText },
        ],
      },
    ],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "";
};

export function createClaudeVisionClient(
  llm: VisionLLMFn = defaultVisionLLM
): VisionQAClient {
  return {
    async analyze(input): Promise<VisionQAResult> {
      const rawText = await llm({
        systemPrompt: SYSTEM_PROMPT,
        userText: buildUserText(input),
        imageBase64: input.imageBytes.toString("base64"),
        imageMediaType: input.imageMimeType,
      });

      const parsed = VisionResultSchema.parse(parseJsonResponse(rawText));
      const { logo_bounds, color_match, safezone, style_consistency } =
        parsed.checks;
      // Score = Mittel der vier Achsen. Badge-Schwellen (gruen >=0.8) greifen darauf.
      const score =
        (logo_bounds + color_match + safezone + style_consistency) / 4;

      return {
        score: Number(score.toFixed(3)),
        checks: parsed.checks,
        notes: parsed.notes,
      };
    },
  };
}
