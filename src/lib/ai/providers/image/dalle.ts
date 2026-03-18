// DALL-E 3 Image Provider - Fallback fuer Nano Banana

import OpenAI from "openai";
import type {
  AIResponse,
  AIUsage,
  ImageAIRequest,
  ImageResponseData,
  GeneratedImage,
} from "../types";
import type { ImageProvider } from "./types";

const DEFAULT_MODEL = "dall-e-3";

let clientInstance: OpenAI | null = null;

function getClient(): OpenAI {
  if (!clientInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY ist nicht gesetzt");
    clientInstance = new OpenAI({ apiKey });
  }
  return clientInstance;
}

// DALL-E 3 unterstuetzt nur bestimmte Groessen
function getDalleSize(width: number, height: number): "1024x1024" | "1792x1024" | "1024x1792" {
  const ratio = width / height;
  if (ratio > 1.3) return "1792x1024";  // Landscape
  if (ratio < 0.7) return "1024x1792";  // Portrait
  return "1024x1024";                    // Square
}

export const dalleProvider: ImageProvider = {
  id: "dalle",
  capability: "image",
  displayName: "DALL-E 3",

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  },

  getSupportedDimensions() {
    return [
      { width: 1024, height: 1024 },
      { width: 1792, height: 1024 },
      { width: 1024, height: 1792 },
    ];
  },

  async execute(
    request: ImageAIRequest
  ): Promise<AIResponse<ImageResponseData>> {
    const client = getClient();
    const model = request.model && request.model !== "default"
      ? request.model
      : DEFAULT_MODEL;

    const size = getDalleSize(request.width, request.height);
    const startMs = Date.now();

    try {
      const response = await client.images.generate({
        model,
        prompt: request.prompt,
        n: 1,
        size,
        quality: "hd",
        style: request.style === "natural" ? "natural" : "vivid",
        response_format: "url",
      });

      const images: GeneratedImage[] = [];
      const [w, h] = size.split("x").map(Number);

      for (const item of response.data ?? []) {
        if (item.url) {
          images.push({
            url: item.url,
            width: w,
            height: h,
            format: "png",
            revisedPrompt: item.revised_prompt ?? undefined,
          });
        }
      }

      if (images.length === 0) {
        throw new Error("Keine Bilder in der DALL-E Antwort erhalten");
      }

      const usage: AIUsage = {
        imagesGenerated: images.length,
      };

      return {
        success: true,
        data: { images },
        provider: "dalle",
        model,
        usage,
        costChf: 0, // Wird vom Router berechnet
        durationMs: Date.now() - startMs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`DALL-E 3 Bildgenerierung fehlgeschlagen: ${message}`);
    }
  },
};
