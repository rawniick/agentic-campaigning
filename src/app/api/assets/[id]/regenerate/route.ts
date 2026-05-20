import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/db/supabase";
import { getCampaignById } from "@/lib/db/queries/campaigns";
import { getSelectedConcept } from "@/lib/db/queries/concepts";
import { getTranslationsByCampaign } from "@/lib/db/queries/translations";
import { updateAssetStatus } from "@/lib/db/queries/assets";
import { logAuditEvent } from "@/lib/db/queries/audit";
import { routeImageTask, routeVideoTask } from "@/lib/ai/providers/router";
import { initializeProviders } from "@/lib/ai/providers/init";
import { uploadFromBase64, uploadFromUrl } from "@/lib/integrations/storage";
import { getAuthUser } from "@/lib/auth/get-user";
import type { Asset, ChannelAdaptations } from "@/types/database";

const FORMAT_IMAGE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  feed: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  banner: { width: 1920, height: 1080 },
  hero: { width: 1920, height: 1080 },
  newsletter: { width: 600, height: 400 },
  poster: { width: 2048, height: 2048 },
};

// POST /api/assets/[id]/regenerate — Einzelnes Asset neu generieren
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { id: assetId } = await params;
    const body = await request.json().catch(() => ({})) as { customPrompt?: string };

    const db = await getServerClient();

    // Asset laden
    const { data: existingAsset, error: assetError } = await db
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .single();

    if (assetError || !existingAsset) {
      return NextResponse.json({ error: "Asset nicht gefunden" }, { status: 404 });
    }

    const asset = existingAsset as Asset;

    // Nur AI-generierte Assets koennen regeneriert werden
    if (asset.generation_mode === "text_only" || asset.generation_mode === "template") {
      return NextResponse.json(
        { error: "Nur AI-generierte Assets koennen regeneriert werden" },
        { status: 400 }
      );
    }

    await initializeProviders();

    // Kampagne + Konzept laden
    const campaign = await getCampaignById(asset.campaign_id);
    const concept = await getSelectedConcept(asset.campaign_id);
    if (!concept) {
      return NextResponse.json({ error: "Kein Konzept gefunden" }, { status: 404 });
    }

    // Content fuer die Sprache laden
    let adaptations: ChannelAdaptations = {};
    let claims: string[] = [];
    let heroMessage = "";

    if (asset.language === "de") {
      adaptations = concept.channel_adaptations ?? {};
      claims = concept.claims?.variants ?? [];
      heroMessage = concept.hero_message ?? "";
    } else {
      const translations = await getTranslationsByCampaign(asset.campaign_id);
      const translation = translations.find(t => t.target_language === asset.language);
      if (translation) {
        adaptations = translation.translated_channel_adaptations ?? {};
        claims = translation.translated_claims?.variants ?? [];
        heroMessage = translation.translated_hero_message ?? "";
      }
    }

    // Status auf rendering setzen
    await updateAssetStatus(assetId, "rendering");

    try {
      const prompt = body.customPrompt ?? asset.ai_prompt ?? buildRegeneratePrompt(campaign, concept, claims, heroMessage, asset);

      if (asset.generation_mode === "ai_image") {
        const dimensions = FORMAT_IMAGE_DIMENSIONS[asset.format] ?? { width: 1024, height: 1024 };
        const response = await routeImageTask({
          taskType: "image_generation",
          campaignId: asset.campaign_id,
          brand: campaign.brand,
          language: asset.language,
          prompt,
          width: dimensions.width,
          height: dimensions.height,
          style: concept.key_visual_direction ?? undefined,
        });

        const image = response.data.images[0];
        if (!image) throw new Error("Kein Bild generiert");

        // In Storage persistieren
        let uploadResult;
        if (image.url.startsWith("data:")) {
          uploadResult = await uploadFromBase64(
            asset.campaign_id, asset.channel, asset.format, asset.language,
            image.url, image.format ?? "png"
          );
        } else {
          uploadResult = await uploadFromUrl(
            asset.campaign_id, asset.channel, asset.format, asset.language,
            image.url, image.format ?? "png"
          );
        }

        // Asset updaten
        const { data: updated } = await db
          .from("assets")
          .update({
            storage_path: uploadResult.publicUrl,
            thumbnail_path: uploadResult.publicUrl,
            storage_url: uploadResult.publicUrl,
            file_size_bytes: uploadResult.fileSize,
            mime_type: uploadResult.mimeType,
            status: "completed",
            error_message: null,
            ai_prompt: prompt,
            ai_provider: response.provider,
          })
          .eq("id", assetId)
          .select()
          .single();

        await logAuditEvent(asset.campaign_id, "asset_regenerated", {
          asset_id: assetId,
          provider: response.provider,
        });

        return NextResponse.json({ asset: updated });

      } else if (asset.generation_mode === "ai_video") {
        const response = await routeVideoTask({
          taskType: "video_generation",
          campaignId: asset.campaign_id,
          brand: campaign.brand,
          language: asset.language,
          prompt,
          aspectRatio: "16:9",
          durationSeconds: 8,
        });

        if (response.data.status === "processing") {
          await db
            .from("assets")
            .update({
              status: "processing",
              error_message: response.data.pollUrl ?? null,
              ai_prompt: prompt,
              ai_provider: response.provider,
            })
            .eq("id", assetId);

          return NextResponse.json({ asset: { ...asset, status: "processing" } });
        }

        // Video direkt fertig
        let uploadResult;
        if (response.data.videoUrl) {
          uploadResult = await uploadFromUrl(
            asset.campaign_id, asset.channel, asset.format, asset.language,
            response.data.videoUrl, "mp4"
          );

          await db
            .from("assets")
            .update({
              storage_path: uploadResult.publicUrl,
              storage_url: uploadResult.publicUrl,
              file_size_bytes: uploadResult.fileSize,
              mime_type: uploadResult.mimeType,
              status: "completed",
              error_message: null,
              ai_prompt: prompt,
              ai_provider: response.provider,
            })
            .eq("id", assetId);
        }

        return NextResponse.json({ asset: { ...asset, status: "completed" } });
      }

      return NextResponse.json({ error: "Unbekannter generation_mode" }, { status: 400 });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Regenerierung fehlgeschlagen";
      await updateAssetStatus(assetId, "failed", errorMessage);
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildRegeneratePrompt(campaign: any, concept: any, claims: string[], heroMessage: string, asset: Asset): string {
  const parts: string[] = [];
  if (concept.key_visual_direction) parts.push(concept.key_visual_direction);
  parts.push(`Produkt: ${campaign.product_name}`);
  if (claims[0]) parts.push(`Claim: "${claims[0]}"`);
  if (heroMessage) parts.push(`Hero Message: "${heroMessage}"`);
  parts.push(`Marke: ${campaign.brand}`);
  parts.push(`Format: ${asset.format}, Kanal: ${asset.channel}`);
  parts.push("WICHTIG: Kein Text im Bild.");
  return parts.join(". ") + ".";
}
