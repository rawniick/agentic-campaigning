// Veo 3.1 (Google) Video Provider

import { GoogleGenAI } from "@google/genai";
import type {
  AIResponse,
  AIUsage,
  VideoAIRequest,
  VideoResponseData,
} from "../types";
import type { VideoProvider } from "./types";

const DEFAULT_MODEL = "veo-3.1-generate-preview";
const POLL_INTERVAL_MS = 10_000; // 10 Sekunden
const MAX_POLL_ATTEMPTS = 60;    // Max 10 Minuten warten

let clientInstance: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!clientInstance) {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENAI_API_KEY ist nicht gesetzt");
    clientInstance = new GoogleGenAI({ apiKey });
  }
  return clientInstance;
}

export const veo3Provider: VideoProvider = {
  id: "veo3",
  capability: "video",
  displayName: "Google Veo 3.1",

  isAvailable(): boolean {
    return !!process.env.GOOGLE_GENAI_API_KEY;
  },

  getMaxDurationSeconds(): number {
    return 8;
  },

  getSupportedAspectRatios(): string[] {
    return ["16:9", "9:16"];
  },

  async execute(
    request: VideoAIRequest
  ): Promise<AIResponse<VideoResponseData>> {
    const client = getClient();
    const model = request.model && request.model !== "default"
      ? request.model
      : DEFAULT_MODEL;

    const aspectRatio = request.aspectRatio ?? "16:9";
    const durationSeconds = Math.min(request.durationSeconds ?? 8, 8);

    const startMs = Date.now();

    try {
      // Video-Generierung starten (asynchron)
      let operation = await client.models.generateVideos({
        model,
        prompt: request.prompt,
        config: {
          aspectRatio,
          resolution: "720p",
          durationSeconds: durationSeconds as unknown as number,
        },
      });

      // Polling bis fertig
      let attempts = 0;
      while (!operation.done && attempts < MAX_POLL_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        operation = await client.operations.getVideosOperation({
          operation,
        });
        attempts++;
      }

      if (!operation.done) {
        // Timeout — gib Poll-URL zurueck fuer spaeteres Abrufen
        return {
          success: true,
          data: {
            videoUrl: "",
            thumbnailUrl: "",
            durationSeconds,
            status: "processing",
            pollUrl: operation.name ?? undefined,
          },
          provider: "veo3",
          model,
          usage: { videoSecondsGenerated: 0 },
          costChf: 0,
          durationMs: Date.now() - startMs,
        };
      }

      // Video fertig
      const generatedVideos = operation.response?.generatedVideos;
      if (!generatedVideos || generatedVideos.length === 0) {
        throw new Error("Keine Videos in der Veo 3 Antwort erhalten");
      }

      const video = generatedVideos[0];
      // Video-URL aus dem File-Objekt extrahieren
      const videoUrl = video.video?.uri ?? "";

      const usage: AIUsage = {
        videoSecondsGenerated: durationSeconds,
      };

      return {
        success: true,
        data: {
          videoUrl,
          thumbnailUrl: "",
          durationSeconds,
          status: "completed",
        },
        provider: "veo3",
        model,
        usage,
        costChf: 0, // Wird vom Router berechnet
        durationMs: Date.now() - startMs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Veo 3.1 Video-Generierung fehlgeschlagen: ${message}`);
    }
  },
};
