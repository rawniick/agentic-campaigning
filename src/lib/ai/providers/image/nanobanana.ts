// Nano Banana 2 (Google Gemini 3.1 Flash Image) - Image Provider

import { GoogleGenAI } from "@google/genai";
import type {
  AIResponse,
  AIUsage,
  ImageAIRequest,
  ImageResponseData,
  GeneratedImage,
} from "../types";
import type { ImageProvider } from "./types";

const DEFAULT_MODEL = "gemini-3.1-flash-image-preview";

let clientInstance: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!clientInstance) {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENAI_API_KEY ist nicht gesetzt");
    clientInstance = new GoogleGenAI({ apiKey });
  }
  return clientInstance;
}

// Aspect Ratio aus Width/Height ableiten
function getAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  if (ratio > 1.9) return "21:9";
  if (ratio > 1.4) return "16:9";
  if (ratio > 1.1) return "4:3";
  if (ratio > 0.9) return "1:1";
  if (ratio > 0.6) return "9:16";
  return "9:16";
}

// Resolution aus Pixel-Breite ableiten
function getImageSize(width: number): string {
  if (width >= 3840) return "4K";
  if (width >= 1920) return "2K";
  if (width >= 1024) return "1K";
  return "512";
}

export const nanobananaProvider: ImageProvider = {
  id: "nanobanana",
  capability: "image",
  displayName: "Google Nano Banana 2",

  isAvailable(): boolean {
    return !!process.env.GOOGLE_GENAI_API_KEY;
  },

  getSupportedDimensions() {
    return [
      { width: 512, height: 512 },
      { width: 1024, height: 1024 },
      { width: 1920, height: 1080 },
      { width: 1080, height: 1920 },
      { width: 2048, height: 2048 },
      { width: 3840, height: 2160 },
    ];
  },

  async execute(
    request: ImageAIRequest
  ): Promise<AIResponse<ImageResponseData>> {
    const client = getClient();
    const model = request.model && request.model !== "default"
      ? request.model
      : DEFAULT_MODEL;

    const aspectRatio = getAspectRatio(request.width, request.height);
    const imageSize = getImageSize(request.width);

    const startMs = Date.now();

    try {
      const response = await client.models.generateContent({
        model,
        contents: request.prompt,
        config: {
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        },
      });

      const images: GeneratedImage[] = [];

      const candidate = response.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            // Base64-encoded Bild — als Data-URL fuer internen Gebrauch
            const dataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            images.push({
              url: dataUrl,
              width: request.width,
              height: request.height,
              format: part.inlineData.mimeType?.split("/")[1] ?? "png",
            });
          }
        }
      }

      if (images.length === 0) {
        throw new Error("Keine Bilder in der Nano Banana Antwort erhalten");
      }

      const usage: AIUsage = {
        imagesGenerated: images.length,
      };

      return {
        success: true,
        data: { images },
        provider: "nanobanana",
        model,
        usage,
        costChf: 0, // Wird vom Router berechnet
        durationMs: Date.now() - startMs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Nano Banana 2 Bildgenerierung fehlgeschlagen: ${message}`);
    }
  },
};
