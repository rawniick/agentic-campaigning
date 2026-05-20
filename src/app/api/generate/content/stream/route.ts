import { NextRequest } from "next/server";
import { getCampaignById, updateCampaignStatus } from "@/lib/db/queries/campaigns";
import { getSelectedConcept } from "@/lib/db/queries/concepts";
import { getTranslationsByCampaign } from "@/lib/db/queries/translations";
import { createAsset } from "@/lib/db/queries/assets";
import { logAuditEvent } from "@/lib/db/queries/audit";
import { getFormatsForChannel } from "@/lib/integrations/canva";
import { routeImageTask } from "@/lib/ai/providers/router";
import { initializeProviders } from "@/lib/ai/providers/init";
import { uploadFromBase64, uploadFromUrl } from "@/lib/integrations/storage";
import { getAuthUser } from "@/lib/auth/get-user";
import type { ChannelAdaptations } from "@/types/database";

// POST /api/generate/content/stream — Asset-Generierung mit SSE Progress
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), { status: 401 });
  }

  const { campaignId, imagePrompt } = await request.json() as {
    campaignId: string;
    imagePrompt?: string;
  };

  if (!campaignId) {
    return new Response(JSON.stringify({ error: "campaignId ist Pflicht" }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: unknown) => {
        const event = `data: ${JSON.stringify({ type, data })}\n\n`;
        controller.enqueue(encoder.encode(event));
      };

      try {
        await initializeProviders();
        const campaign = await getCampaignById(campaignId);

        if (campaign.status !== "translations_ready" && campaign.status !== "concept_approved") {
          send("error", { message: `Status ${campaign.status} ist nicht generierbar (erwartet: translations_ready oder concept_approved)` });
          controller.close();
          return;
        }

        const concept = await getSelectedConcept(campaignId);
        if (!concept) {
          send("error", { message: "Kein Konzept gefunden" });
          controller.close();
          return;
        }

        const translations = await getTranslationsByCampaign(campaignId);
        await updateCampaignStatus(campaignId, "rendering_assets");

        // Content pro Sprache sammeln
        const languageContent: Record<string, {
          adaptations: ChannelAdaptations;
          claims: string[];
          heroMessage: string;
          translationId: string | null;
        }> = {};

        if (campaign.languages.includes("de")) {
          languageContent["de"] = {
            adaptations: concept.channel_adaptations ?? {},
            claims: concept.claims?.variants ?? [],
            heroMessage: concept.hero_message ?? "",
            translationId: null,
          };
        }
        for (const t of translations) {
          languageContent[t.target_language] = {
            adaptations: t.translated_channel_adaptations ?? {},
            claims: t.translated_claims?.variants ?? [],
            heroMessage: t.translated_hero_message ?? "",
            translationId: t.id,
          };
        }

        // Total berechnen
        let totalAssets = 0;
        for (const channel of campaign.channels) {
          const formats = getFormatsForChannel(channel);
          totalAssets += formats.length * campaign.languages.length;
        }

        send("start", { total: totalAssets, channels: campaign.channels, languages: campaign.languages });

        let completed = 0;
        let failed = 0;

        for (const channel of campaign.channels) {
          const formats = getFormatsForChannel(channel);

          for (const { format } of formats) {
            for (const lang of campaign.languages) {
              const content = languageContent[lang];
              if (!content) continue;

              const isTextOnly = format === "text_only" || channel === "sea";

              send("progress", {
                completed,
                total: totalAssets,
                current: { channel, format, language: lang },
              });

              try {
                if (isTextOnly) {
                  await createAsset({
                    campaign_id: campaignId,
                    concept_id: concept.id,
                    translation_id: content.translationId,
                    format, language: lang, channel,
                    canva_template_id: null, canva_design_id: null,
                    storage_path: null, thumbnail_path: null,
                    status: "completed", error_message: null,
                    exported_to: null, export_ids: null,
                    generation_mode: "text_only",
                    ai_prompt: null, ai_provider: null,
                    storage_url: null, file_size_bytes: null, mime_type: null,
                    candidate_group_id: null, is_selected_candidate: false,
                  });
                } else {
                  const prompt = imagePrompt ?? `Marketing-Visual fuer ${campaign.product_name}. ${concept.key_visual_direction ?? ""}. Kanal: ${channel}, Format: ${format}. Kein Text im Bild.`;
                  const dims: Record<string, { w: number; h: number }> = {
                    feed: { w: 1080, h: 1080 }, story: { w: 1080, h: 1920 },
                    banner: { w: 1920, h: 1080 }, hero: { w: 1920, h: 1080 },
                    newsletter: { w: 600, h: 400 }, poster: { w: 2048, h: 2048 },
                  };
                  const d = dims[format] ?? { w: 1024, h: 1024 };

                  const response = await routeImageTask({
                    taskType: "image_generation",
                    campaignId, brand: campaign.brand, language: lang,
                    prompt, width: d.w, height: d.h,
                    style: concept.key_visual_direction ?? undefined,
                  });

                  const image = response.data.images[0];
                  if (image) {
                    let uploadResult;
                    if (image.url.startsWith("data:")) {
                      uploadResult = await uploadFromBase64(campaignId, channel, format, lang, image.url);
                    } else {
                      uploadResult = await uploadFromUrl(campaignId, channel, format, lang, image.url);
                    }

                    await createAsset({
                      campaign_id: campaignId,
                      concept_id: concept.id,
                      translation_id: content.translationId,
                      format, language: lang, channel,
                      canva_template_id: null, canva_design_id: null,
                      storage_path: uploadResult.publicUrl,
                      thumbnail_path: uploadResult.publicUrl,
                      status: "completed", error_message: null,
                      exported_to: null, export_ids: null,
                      generation_mode: "ai_image",
                      ai_prompt: prompt, ai_provider: response.provider,
                      storage_url: uploadResult.publicUrl,
                      file_size_bytes: uploadResult.fileSize,
                      mime_type: uploadResult.mimeType,
                      candidate_group_id: null, is_selected_candidate: false,
                    });
                  }
                }

                completed++;
              } catch (err) {
                failed++;
                const errorMsg = err instanceof Error ? err.message : "Fehler";
                await createAsset({
                  campaign_id: campaignId,
                  concept_id: concept.id,
                  translation_id: content.translationId,
                  format, language: lang, channel,
                  canva_template_id: null, canva_design_id: null,
                  storage_path: null, thumbnail_path: null,
                  status: "failed", error_message: errorMsg,
                  exported_to: null, export_ids: null,
                  generation_mode: "ai_image",
                  ai_prompt: null, ai_provider: null,
                  storage_url: null, file_size_bytes: null, mime_type: null,
                  candidate_group_id: null, is_selected_candidate: false,
                });
              }
            }
          }
        }

        // Status updaten
        if (completed > 0) {
          await updateCampaignStatus(campaignId, "assets_ready");
        } else {
          await updateCampaignStatus(campaignId, "translations_ready");
        }

        await logAuditEvent(campaignId, "assets_generated_streaming", {
          total: completed + failed,
          completed,
          failed,
        });

        send("complete", { completed, failed, total: completed + failed });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
        const event = `data: ${JSON.stringify({ type: "error", data: { message: msg } })}\n\n`;
        controller.enqueue(encoder.encode(event));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
