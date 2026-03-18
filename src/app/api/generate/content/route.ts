import { NextRequest, NextResponse } from "next/server";
import { getCampaignById, updateCampaignStatus } from "@/lib/db/queries/campaigns";
import { getSelectedConcept } from "@/lib/db/queries/concepts";
import { getTranslationsByCampaign } from "@/lib/db/queries/translations";
import { createAsset } from "@/lib/db/queries/assets";
import { createApproval, logAuditEvent } from "@/lib/db/queries/approvals";
import {
  buildCanvaConfig,
  listTemplates,
  fillTemplate,
  getFormatsForChannel,
} from "@/lib/integrations/canva";
import { routeImageTask, routeVideoTask } from "@/lib/ai/providers/router";
import { initializeProviders } from "@/lib/ai/providers/init";
import { uploadFromBase64, uploadFromUrl } from "@/lib/integrations/storage";
import { compositeAsset } from "@/lib/compositing/engine";
import { uploadBuffer } from "@/lib/integrations/storage";
import { isCanvaAvailable, createDesignFromTemplate, exportDesign } from "@/lib/integrations/canva-api";
import type { ChannelAdaptations, Campaign, Concept } from "@/types/database";
import { getAuthUser } from "@/lib/auth/get-user";

// Generierungsmodus pro Asset
type GenerationMode = "template" | "ai_image" | "ai_video" | "text_only";

// Format → Bild-Dimensionen Mapping
const FORMAT_IMAGE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  feed: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  banner: { width: 1920, height: 1080 },
  hero: { width: 1920, height: 1080 },
  newsletter: { width: 600, height: 400 },
  poster: { width: 2048, height: 2048 },
};

// Format → Video Aspect Ratio Mapping
const FORMAT_VIDEO_ASPECT: Record<string, "16:9" | "9:16" | "1:1"> = {
  feed: "1:1",
  story: "9:16",
  banner: "16:9",
  hero: "16:9",
};

// POST /api/generate/content - Assets fuer alle Kanaele/Sprachen/Formate generieren
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const body = await request.json();
    const { campaignId, generationMode: requestedMode, imagePrompt, videoPrompt } = body as {
      campaignId: string;
      generationMode?: GenerationMode;
      imagePrompt?: string;
      videoPrompt?: string;
    };

    if (!campaignId) {
      return NextResponse.json({ error: "campaignId ist Pflicht" }, { status: 400 });
    }

    // Validierung: generationMode
    const validModes: GenerationMode[] = ["template", "ai_image", "ai_video", "text_only"];
    if (requestedMode && !validModes.includes(requestedMode)) {
      return NextResponse.json(
        { error: `Ungueltiger generationMode: ${requestedMode}. Erlaubt: ${validModes.join(", ")}` },
        { status: 400 }
      );
    }

    // Provider initialisieren fuer AI-Modi
    if (requestedMode === "ai_image" || requestedMode === "ai_video") {
      await initializeProviders();
    }

    // 1. Campaign laden und Status pruefen
    const campaign = await getCampaignById(campaignId);
    if (campaign.status !== "translations_approved") {
      return NextResponse.json(
        { error: `Ungueltiger Status: ${campaign.status}. Erwartet: translations_approved` },
        { status: 400 }
      );
    }

    // 2. Konzept + Uebersetzungen laden
    const concept = await getSelectedConcept(campaignId);
    if (!concept) {
      return NextResponse.json(
        { error: "Kein ausgewaehltes Konzept gefunden" },
        { status: 404 }
      );
    }

    const translations = await getTranslationsByCampaign(campaignId);

    // 3. Status → rendering_assets
    await updateCampaignStatus(campaignId, "rendering_assets");

    // 4. Canva-Konfiguration (nur fuer template-Modus)
    const canvaConfig = requestedMode !== "ai_image" && requestedMode !== "ai_video"
      ? buildCanvaConfig()
      : null;

    // 5. Sprach-Content zusammenbauen: DE aus Konzept, Rest aus Uebersetzungen
    const languageContent: Record<string, {
      adaptations: ChannelAdaptations;
      claims: string[];
      heroMessage: string;
      translationId: string | null;
    }> = {};

    // DE (Quellsprache) aus Konzept
    if (campaign.languages.includes("de")) {
      languageContent["de"] = {
        adaptations: concept.channel_adaptations ?? {},
        claims: concept.claims?.variants ?? [],
        heroMessage: concept.hero_message ?? "",
        translationId: null,
      };
    }

    // Weitere Sprachen aus Uebersetzungen
    for (const translation of translations) {
      languageContent[translation.target_language] = {
        adaptations: translation.translated_channel_adaptations ?? {},
        claims: translation.translated_claims?.variants ?? [],
        heroMessage: translation.translated_hero_message ?? "",
        translationId: translation.id,
      };
    }

    // 6. Assets generieren: Kanal x Sprache x Format
    const createdAssets = [];
    let assetErrors = 0;

    for (const channel of campaign.channels) {
      const formats = getFormatsForChannel(channel);
      const templates = requestedMode !== "ai_image" && requestedMode !== "ai_video"
        ? await listTemplates(canvaConfig, channel)
        : [];

      for (const { format } of formats) {
        for (const lang of campaign.languages) {
          const content = languageContent[lang];
          if (!content) continue;

          // Effektiver Modus bestimmen
          const effectiveMode = resolveGenerationMode(requestedMode, format, channel);

          // Template fuer diesen Kanal/Format finden (nur bei template-Modus)
          const template = effectiveMode === "template"
            ? templates.find((t) => t.format === format)
            : undefined;

          try {
            let canvaDesignId: string | null = null;
            let storagePath: string | null = null;
            let thumbnailPath: string | null = null;
            let aiPrompt: string | null = null;
            let aiProvider: string | null = null;

            if (effectiveMode === "template" && template) {
              // Canva Template-Filling (bestehende Logik)
              const templateContent = buildTemplateContent(content.adaptations, channel, content.claims, content.heroMessage);
              const design = await fillTemplate(canvaConfig, template.id, templateContent);
              canvaDesignId = design.id;
              storagePath = design.exportUrl;
              thumbnailPath = design.thumbnailUrl;

            } else if (effectiveMode === "ai_image") {
              // AI-Bildgenerierung + persistentes Storage
              const prompt = imagePrompt ?? buildImagePrompt(campaign, concept, content, channel, format, lang);
              const dimensions = FORMAT_IMAGE_DIMENSIONS[format] ?? { width: 1024, height: 1024 };

              const response = await routeImageTask({
                taskType: "image_generation",
                campaignId,
                brand: campaign.brand,
                language: lang,
                prompt,
                width: dimensions.width,
                height: dimensions.height,
                style: concept.key_visual_direction ?? undefined,
              });

              // Erstes generiertes Bild → Supabase Storage persistieren
              const image = response.data.images[0];
              if (image) {
                try {
                  let uploadResult;
                  if (image.url.startsWith("data:")) {
                    // NanoBanana: Base64 data-URL → Storage
                    uploadResult = await uploadFromBase64(
                      campaignId, channel, format, lang,
                      image.url, image.format ?? "png"
                    );
                  } else {
                    // DALL-E: Temporaere URL → Download → Storage
                    uploadResult = await uploadFromUrl(
                      campaignId, channel, format, lang,
                      image.url, image.format ?? "png"
                    );
                  }
                  storagePath = uploadResult.publicUrl;
                  thumbnailPath = uploadResult.publicUrl;
                } catch (uploadErr) {
                  // Fallback: Originale URL verwenden wenn Upload fehlschlaegt
                  console.warn("Storage-Upload fehlgeschlagen, verwende Original-URL:", uploadErr);
                  storagePath = image.url;
                  thumbnailPath = image.url;
                }
              }
              aiPrompt = prompt;
              aiProvider = response.provider;

            } else if (effectiveMode === "ai_video") {
              // AI-Videogenerierung
              const prompt = videoPrompt ?? buildVideoPrompt(campaign, concept, content, channel, format, lang);
              const aspectRatio = FORMAT_VIDEO_ASPECT[format] ?? "16:9";

              const response = await routeVideoTask({
                taskType: "video_generation",
                campaignId,
                brand: campaign.brand,
                language: lang,
                prompt,
                aspectRatio,
                durationSeconds: 8,
              });

              aiPrompt = prompt;
              aiProvider = response.provider;

              // Video direkt fertig → in Storage persistieren
              if (response.data.videoUrl) {
                try {
                  const videoUpload = await uploadFromUrl(
                    campaignId, channel, format, lang,
                    response.data.videoUrl, "mp4"
                  );
                  storagePath = videoUpload.publicUrl;
                } catch {
                  storagePath = response.data.videoUrl;
                }
              }
              thumbnailPath = response.data.thumbnailUrl || null;

              // Video noch im Processing → Status "processing" statt "completed"
              if (response.data.status === "processing") {
                const processingAsset = await createAsset({
                  campaign_id: campaignId,
                  concept_id: concept.id,
                  translation_id: content.translationId,
                  format,
                  language: lang,
                  channel,
                  canva_template_id: null,
                  canva_design_id: null,
                  storage_path: null,
                  thumbnail_path: null,
                  status: "processing",
                  error_message: response.data.pollUrl ?? null,
                  exported_to: null,
                  export_ids: null,
                  generation_mode: "ai_video",
                  ai_prompt: aiPrompt,
                  ai_provider: aiProvider,
                  storage_url: null,
                  file_size_bytes: null,
                  mime_type: null,
                  candidate_group_id: null,
                  is_selected_candidate: false,
                });
                createdAssets.push(processingAsset);
                continue;
              }
            }

            // text_only oder erfolgreich generiert
            const asset = await createAsset({
              campaign_id: campaignId,
              concept_id: concept.id,
              translation_id: content.translationId,
              format,
              language: lang,
              channel,
              canva_template_id: template?.id ?? null,
              canva_design_id: canvaDesignId,
              storage_path: storagePath,
              thumbnail_path: thumbnailPath,
              status: "completed",
              error_message: null,
              exported_to: null,
              export_ids: null,
              generation_mode: effectiveMode,
              ai_prompt: aiPrompt,
              ai_provider: aiProvider,
              storage_url: storagePath,
              file_size_bytes: null,
              mime_type: null,
              candidate_group_id: null,
              is_selected_candidate: false,
            });

            createdAssets.push(asset);
          } catch (err) {
            assetErrors++;
            // Asset mit Fehlerstatus erstellen
            const errorMessage = err instanceof Error ? err.message : "Unbekannter Fehler";
            const failedAsset = await createAsset({
              campaign_id: campaignId,
              concept_id: concept.id,
              translation_id: content.translationId,
              format,
              language: lang,
              channel,
              canva_template_id: template?.id ?? null,
              canva_design_id: null,
              storage_path: null,
              thumbnail_path: null,
              status: "failed",
              error_message: errorMessage,
              exported_to: null,
              export_ids: null,
              generation_mode: effectiveMode,
              ai_prompt: null,
              ai_provider: null,
              storage_url: null,
              file_size_bytes: null,
              mime_type: null,
              candidate_group_id: null,
              is_selected_candidate: false,
            });
            createdAssets.push(failedAsset);
          }
        }
      }
    }

    // 7. Status: nur assets_ready wenn mindestens 1 Asset erfolgreich oder processing
    const successCount = createdAssets.filter((a) => a.status === "completed" || a.status === "processing").length;
    if (successCount > 0) {
      await updateCampaignStatus(campaignId, "assets_ready");
      // 8. Approval fuer Stage 3 (assets) erstellen
      await createApproval(campaignId, "assets");
    } else {
      // Alle fehlgeschlagen: zurueck zu translations_approved
      await updateCampaignStatus(campaignId, "translations_approved");
    }

    // 9. Audit-Log
    await logAuditEvent(campaignId, "assets_generated", {
      total_assets: createdAssets.length,
      failed_assets: assetErrors,
      channels: campaign.channels,
      languages: campaign.languages,
      generation_mode: requestedMode ?? "template",
      mock_mode: canvaConfig === null && !requestedMode,
    });

    return NextResponse.json({
      assets: createdAssets,
      summary: {
        total: createdAssets.length,
        completed: createdAssets.filter((a) => a.status === "completed").length,
        processing: createdAssets.filter((a) => a.status === "processing").length,
        failed: assetErrors,
        channels: campaign.channels,
        languages: campaign.languages,
        generation_mode: requestedMode ?? "template",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Effektiven Modus bestimmen:
 * - SEA ist immer text_only
 * - ai_video nur fuer visuelle Formate (nicht newsletter, poster, text_only)
 * - Sonst den angeforderten Modus oder default "template"
 */
function resolveGenerationMode(
  requestedMode: GenerationMode | undefined,
  format: string,
  channel: string
): GenerationMode {
  // SEA ist immer text_only
  if (format === "text_only" || channel === "sea") return "text_only";

  // Video nur fuer geeignete Formate
  if (requestedMode === "ai_video") {
    const videoFormats = ["feed", "story", "banner", "hero"];
    if (!videoFormats.includes(format)) return "ai_image"; // Fallback auf Bild
  }

  return requestedMode ?? "template";
}

/**
 * AI-Bild-Prompt aus Kampagnen-Kontext bauen.
 * Kombiniert Key Visual Direction, Claims und Kanal-Kontext.
 */
function buildImagePrompt(
  campaign: Campaign,
  concept: Concept,
  content: { claims: string[]; heroMessage: string; adaptations: ChannelAdaptations },
  channel: string,
  format: string,
  lang: string
): string {
  const parts: string[] = [];

  // Key Visual Direction als Haupt-Anweisung
  if (concept.key_visual_direction) {
    parts.push(concept.key_visual_direction);
  }

  // Produkt-Kontext
  parts.push(`Produkt: ${campaign.product_name} (${campaign.product_type})`);

  // Claim fuer visuellen Kontext
  if (content.claims[0]) {
    parts.push(`Claim: "${content.claims[0]}"`);
  }

  // Hero Message
  if (content.heroMessage) {
    parts.push(`Hero Message: "${content.heroMessage}"`);
  }

  // Kanal- und Format-spezifische Hinweise
  const channelHints: Record<string, string> = {
    social: "Social Media Marketing-Visual, modern, aufmerksamkeitsstark",
    crm: "E-Mail Marketing Header-Visual, professionell, klar",
    website: "Website Hero-Visual, hochwertig, immersiv",
    print: "Print-Visual, hochaufloesend, druckfertig",
  };
  if (channelHints[channel]) {
    parts.push(channelHints[channel]);
  }

  const formatHints: Record<string, string> = {
    feed: "Quadratisches Format, Social Feed",
    story: "Hochformat 9:16, Story/Reel",
    banner: "Breitbild-Banner, Querformat",
    hero: "Hero-Image, gross und prominent",
    newsletter: "Newsletter-Header, kompakt",
    poster: "Print-Poster, grossflaechig",
  };
  if (formatHints[format]) {
    parts.push(formatHints[format]);
  }

  // Brand-Hinweis
  parts.push(`Marke: ${campaign.brand}`);

  // Sprache als Kontext (fuer Text-Overlays im Bild)
  const langNames: Record<string, string> = { de: "Deutsch", fr: "Franzoesisch", it: "Italienisch", en: "Englisch" };
  parts.push(`Sprache: ${langNames[lang] ?? lang}`);

  // Keine Text-Overlays im Bild — wird separat via Template gemacht
  parts.push("WICHTIG: Kein Text im Bild. Nur visuelles Key Visual ohne Schrift.");

  return parts.join(". ") + ".";
}

/**
 * AI-Video-Prompt aus Kampagnen-Kontext bauen.
 */
function buildVideoPrompt(
  campaign: Campaign,
  concept: Concept,
  content: { claims: string[]; heroMessage: string; adaptations: ChannelAdaptations },
  channel: string,
  format: string,
  lang: string
): string {
  const parts: string[] = [];

  // Key Visual Direction als Ausgangspunkt
  if (concept.key_visual_direction) {
    parts.push(concept.key_visual_direction);
  }

  // Produkt-Kontext
  parts.push(`Kurzes Marketing-Video fuer ${campaign.product_name}`);

  // Hero Message als narrativer Anker
  if (content.heroMessage) {
    parts.push(`Kernbotschaft: "${content.heroMessage}"`);
  }

  // Kanal-spezifische Anweisungen
  const channelVideoHints: Record<string, string> = {
    social: "Social Media Video, dynamisch, Aufmerksamkeit in den ersten 2 Sekunden",
    website: "Website Hero-Video, elegant, langsame Kamerabewegung",
  };
  if (channelVideoHints[channel]) {
    parts.push(channelVideoHints[channel]);
  }

  const formatVideoHints: Record<string, string> = {
    feed: "Quadratisches Video fuer Social Feed",
    story: "Vertikales Video fuer Story/Reel, 9:16",
    banner: "Animierter Banner, Querformat",
    hero: "Hero-Video, cinematisch, Breitbild",
  };
  if (formatVideoHints[format]) {
    parts.push(formatVideoHints[format]);
  }

  parts.push(`Marke: ${campaign.brand}`);
  parts.push("WICHTIG: Kein Text-Overlay im Video. Rein visuell, Stimmung und Produkt zeigen.");

  return parts.join(". ") + ".";
}

// Kanal-Adaptionen in flache Key-Value Map fuer Template-Filling umwandeln
function buildTemplateContent(
  adaptations: ChannelAdaptations,
  channel: string,
  claims: string[],
  heroMessage: string
): Record<string, string> {
  const content: Record<string, string> = {
    claim: claims[0] ?? "",
    hero_message: heroMessage,
  };

  if (channel === "social" && adaptations.social) {
    content["hook"] = adaptations.social.hook ?? "";
    content["body"] = adaptations.social.body ?? "";
    content["cta"] = adaptations.social.cta ?? "";
    content["hashtags"] = adaptations.social.hashtags?.join(" ") ?? "";
  }

  if (channel === "crm" && adaptations.crm) {
    content["subject_line"] = adaptations.crm.subject_line ?? "";
    content["preview_text"] = adaptations.crm.preview_text ?? "";
    content["headline"] = adaptations.crm.headline ?? "";
    content["body"] = adaptations.crm.body ?? "";
    content["cta"] = adaptations.crm.cta ?? "";
  }

  if (channel === "website" && adaptations.website) {
    content["hero_headline"] = adaptations.website.hero_headline ?? "";
    content["hero_subline"] = adaptations.website.hero_subline ?? "";
    content["cta_primary"] = adaptations.website.cta_primary ?? "";
    if (adaptations.website.cta_secondary) {
      content["cta_secondary"] = adaptations.website.cta_secondary;
    }
  }

  if (channel === "sea" && adaptations.sea) {
    content["headlines"] = adaptations.sea.headlines?.join(" | ") ?? "";
    content["descriptions"] = adaptations.sea.descriptions?.join(" | ") ?? "";
  }

  if (channel === "print" && adaptations.print) {
    content["headline"] = adaptations.print.headline ?? "";
    content["subline"] = adaptations.print.subline ?? "";
    content["body"] = adaptations.print.body ?? "";
    content["pflichttext"] = adaptations.print.pflichttext ?? "";
  }

  return content;
}
