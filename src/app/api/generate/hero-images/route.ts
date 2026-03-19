import { NextRequest, NextResponse } from "next/server";
import { getCampaignById } from "@/lib/db/queries/campaigns";
import { getSelectedConcept } from "@/lib/db/queries/concepts";
import { createAsset } from "@/lib/db/queries/assets";
import { logAuditEvent } from "@/lib/db/queries/approvals";
import { routeImageTask } from "@/lib/ai/providers/router";
import { initializeProviders } from "@/lib/ai/providers/init";
import { providerRegistry } from "@/lib/ai/providers/registry";
import { uploadFromBase64, uploadFromUrl, uploadBuffer } from "@/lib/integrations/storage";
import { compositeAsset } from "@/lib/compositing/engine";
import { getAuthUser } from "@/lib/auth/get-user";
import { randomUUID } from "crypto";

const HERO_CANDIDATES_COUNT = 3;
const HERO_DIMENSIONS = { width: 1920, height: 1080 };

// POST /api/generate/hero-images — 3 Hero-Bild-Kandidaten generieren
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { campaignId, customPrompt } = await request.json() as {
      campaignId: string;
      customPrompt?: string;
    };

    if (!campaignId) {
      return NextResponse.json({ error: "campaignId ist Pflicht" }, { status: 400 });
    }

    const campaign = await getCampaignById(campaignId);
    const concept = await getSelectedConcept(campaignId);
    if (!concept) {
      return NextResponse.json({ error: "Kein ausgewaehltes Konzept gefunden" }, { status: 404 });
    }

    await initializeProviders();

    // Gruppe fuer Kandidaten
    const candidateGroupId = randomUUID();
    const candidates = [];

    // Basis-Prompt bauen
    const basePrompt = customPrompt ?? buildHeroPrompt(campaign, concept);

    // 3 Kandidaten mit leicht variierten Prompts generieren
    const variations = [
      basePrompt,
      `${basePrompt} Alternative Perspektive, anderer Blickwinkel.`,
      `${basePrompt} Andere Farbstimmung, kreativer Ansatz.`,
    ];

    // Pruefen ob ein AI-Image-Provider verfuegbar ist
    const hasImageProvider = providerRegistry.getByCapability("image").length > 0;

    for (let i = 0; i < HERO_CANDIDATES_COUNT; i++) {
      try {
        let uploadResult;
        let provider = "compositing";

        if (hasImageProvider) {
          // AI-Image-Provider (NanoBanana, DALL-E)
          const response = await routeImageTask({
            taskType: "image_generation",
            campaignId,
            brand: campaign.brand,
            language: "de",
            prompt: variations[i],
            width: HERO_DIMENSIONS.width,
            height: HERO_DIMENSIONS.height,
            style: concept.key_visual_direction ?? undefined,
          });

          const image = response.data.images[0];
          if (!image) continue;

          if (image.url.startsWith("data:")) {
            uploadResult = await uploadFromBase64(
              campaignId, "hero", `candidate_${i}`, "de",
              image.url, image.format ?? "png"
            );
          } else {
            uploadResult = await uploadFromUrl(
              campaignId, "hero", `candidate_${i}`, "de",
              image.url, image.format ?? "png"
            );
          }
          provider = response.provider;
        } else {
          // Compositing-Fallback: Branded Placeholder mit Text
          const brandColors = [
            { bg: "#0028A5", primary: "#00ADEF", text: "#FFFFFF" }, // Variante 1
            { bg: "#1A1A2E", primary: "#E94560", text: "#FFFFFF" }, // Variante 2
            { bg: "#16213E", primary: "#0F3460", text: "#E94560" }, // Variante 3
          ];
          const colors = brandColors[i % brandColors.length];

          const result = await compositeAsset({
            content: {
              claim: concept.leitidee ?? campaign.product_name,
              hero_message: concept.hero_message ?? "",
            },
            format: "hero",
            channel: "hero",
            brand: {
              primaryColor: colors.primary,
              secondaryColor: colors.bg,
              backgroundColor: colors.bg,
              textColor: colors.text,
            },
          });

          uploadResult = await uploadBuffer(
            campaignId, "hero", `candidate_${i}`, "de",
            result.buffer, result.mimeType, "png"
          );
        }

        // Asset-Record erstellen
        const asset = await createAsset({
          campaign_id: campaignId,
          concept_id: concept.id,
          translation_id: null,
          format: "hero",
          language: "de",
          channel: "hero",
          canva_template_id: null,
          canva_design_id: null,
          storage_path: uploadResult.publicUrl,
          thumbnail_path: uploadResult.publicUrl,
          status: "completed",
          error_message: null,
          exported_to: null,
          export_ids: null,
          generation_mode: hasImageProvider ? "ai_image" : "compositing",
          ai_prompt: variations[i],
          ai_provider: provider,
          storage_url: uploadResult.publicUrl,
          file_size_bytes: uploadResult.fileSize,
          mime_type: uploadResult.mimeType,
          candidate_group_id: candidateGroupId,
          is_selected_candidate: false,
        });

        candidates.push(asset);
      } catch (err) {
        console.error(`Hero-Kandidat ${i} fehlgeschlagen:`, err);
      }
    }

    await logAuditEvent(campaignId, "hero_candidates_generated", {
      candidate_count: candidates.length,
      candidate_group_id: candidateGroupId,
    });

    return NextResponse.json({
      candidates,
      candidateGroupId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildHeroPrompt(campaign: any, concept: any): string {
  const parts: string[] = [];

  if (concept.key_visual_direction) {
    parts.push(concept.key_visual_direction);
  }

  parts.push(`Hero-Bild fuer ${campaign.product_name} Kampagne`);
  parts.push(`Marke: ${campaign.brand}`);

  if (concept.hero_message) {
    parts.push(`Kernbotschaft: "${concept.hero_message}"`);
  }

  if (concept.leitidee) {
    parts.push(`Leitidee: "${concept.leitidee}"`);
  }

  parts.push("Hochaufloesendes, professionelles Marketing-Visual");
  parts.push("WICHTIG: Kein Text im Bild. Nur visuelles Key Visual ohne Schrift.");

  return parts.join(". ") + ".";
}
