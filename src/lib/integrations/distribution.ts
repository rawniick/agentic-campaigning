// Distribution Orchestrator - koordiniert Meta, Google Ads, Drive

import type { Asset, Campaign, DistributionPlatform } from "@/types/database";
import { markAssetExported } from "@/lib/db/queries/assets";
import {
  createDistribution,
  updateDistribution,
} from "@/lib/db/queries/distributions";
import { buildMetaConfig, uploadImage, createAdCreative } from "./meta-ads";
import { buildGoogleAdsConfig, createResponsiveSearchAd, uploadImageAsset } from "./google-ads";
import { buildDriveWriteConfig, createCampaignArchive } from "./google-drive";

// Channel → Platform Mapping
const CHANNEL_PLATFORM_MAP: Record<string, DistributionPlatform> = {
  social: "meta",
  sea: "google_ads",
};

interface DistributionResult {
  platform: DistributionPlatform;
  status: "completed" | "failed" | "partial";
  successCount: number;
  errorCount: number;
  platformCampaignId?: string;
  error?: string;
}

/**
 * Kampagne an ausgewaehlte Plattformen verteilen.
 * Laeuft durch Assets, ruft passende Integration, markiert exported_to.
 */
export async function distributeCampaign(
  campaign: Campaign,
  assets: Asset[],
  platforms: DistributionPlatform[]
): Promise<DistributionResult[]> {
  // Alle Plattformen parallel verteilen
  const platformTasks = platforms.map(async (platform) => {
    const platformAssets = getPlatformAssets(assets, platform);

    // Distribution-Record erstellen
    const distribution = await createDistribution({
      campaign_id: campaign.id,
      platform,
      asset_count: platformAssets.length,
    });

    try {
      await updateDistribution(distribution.id, { status: "uploading" });

      let result: DistributionResult;

      switch (platform) {
        case "meta":
          result = await distributeToMeta(campaign, platformAssets);
          break;
        case "google_ads":
          result = await distributeToGoogleAds(campaign, platformAssets);
          break;
        case "google_drive":
          result = await distributeToDrive(campaign, assets);
          break;
        default:
          result = {
            platform,
            status: "failed",
            successCount: 0,
            errorCount: 0,
            error: `Unbekannte Plattform: ${platform}`,
          };
      }

      // Drive-spezifische Felder setzen
      const updateData: Record<string, unknown> = {
        status: result.status,
        success_count: result.successCount,
        error_count: result.errorCount,
        platform_campaign_id: result.platformCampaignId ?? null,
        error_message: result.error ?? null,
      };
      if (platform === "google_drive" && result.platformCampaignId) {
        updateData.drive_folder_id = result.platformCampaignId;
        updateData.drive_folder_url = `https://drive.google.com/drive/folders/${result.platformCampaignId}`;
      }

      await updateDistribution(distribution.id, updateData);

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler";
      await updateDistribution(distribution.id, {
        status: "failed",
        error_message: message,
      });
      return {
        platform,
        status: "failed" as const,
        successCount: 0,
        errorCount: platformAssets.length,
        error: message,
      };
    }
  });

  return Promise.all(platformTasks);
}

// Assets nach Plattform filtern
function getPlatformAssets(assets: Asset[], platform: DistributionPlatform): Asset[] {
  if (platform === "google_drive") return assets; // Alle fuer Drive

  // Finde Kanaele fuer diese Plattform
  const channels = Object.entries(CHANNEL_PLATFORM_MAP)
    .filter(([, p]) => p === platform)
    .map(([ch]) => ch);

  return assets.filter((a) => channels.includes(a.channel) && a.status === "completed");
}

// Meta-Distribution: Social-Assets hochladen (Bilder + Videos)
async function distributeToMeta(
  campaign: Campaign,
  assets: Asset[]
): Promise<DistributionResult> {
  const config = buildMetaConfig();
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (const asset of assets) {
    try {
      const exportUrl = asset.storage_url ?? asset.storage_path ?? asset.thumbnail_path;
      if (!exportUrl) {
        errorCount++;
        errors.push(`Asset ${asset.id}: Keine URL verfuegbar`);
        continue;
      }

      // Video-Assets ueber Video-Upload API
      if (isVideoAsset(asset)) {
        const { uploadVideo } = await import("./meta-ads");
        const videoId = await uploadVideo(config, exportUrl, `${campaign.promo_id}_${asset.format}_${asset.language}`);
        await markAssetExported(asset.id, "meta", videoId);
        successCount++;
        continue;
      }

      // Bild hochladen
      const { hash } = await uploadImage(config, exportUrl, `${campaign.promo_id}_${asset.format}_${asset.language}`);

      // Creative erstellen
      const creative = await createAdCreative(config, {
        name: `${campaign.promo_id} - ${asset.format} - ${asset.language}`,
        imageHash: hash,
        message: campaign.product_name,
      });

      await markAssetExported(asset.id, "meta", creative.id);
      successCount++;
    } catch (error) {
      errorCount++;
      errors.push(`Asset ${asset.id}: ${error instanceof Error ? error.message : "Fehler"}`);
    }
  }

  return {
    platform: "meta",
    status: errorCount === 0 ? "completed" : successCount === 0 ? "failed" : "partial",
    successCount,
    errorCount,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

// Google Ads Distribution: SEA-Assets hochladen
async function distributeToGoogleAds(
  campaign: Campaign,
  assets: Asset[]
): Promise<DistributionResult> {
  const config = buildGoogleAdsConfig();
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (const asset of assets) {
    try {
      if (asset.format === "text_only") {
        // SEA Text-Ads: Responsive Search Ad erstellen
        const adaptations = campaign.claim_direction
          ? { headlines: [campaign.product_name], descriptions: [campaign.claim_direction] }
          : { headlines: [campaign.product_name], descriptions: ["Jetzt entdecken"] };

        const ad = await createResponsiveSearchAd(config, {
          campaignResourceName: `customers/${config?.customerId ?? "mock"}/campaigns/mock`,
          adGroupResourceName: `customers/${config?.customerId ?? "mock"}/adGroups/mock`,
          headlines: adaptations.headlines,
          descriptions: adaptations.descriptions,
          finalUrl: "https://www.coopmobile.ch",
        });

        await markAssetExported(asset.id, "google_ads", ad.id);
        successCount++;
      } else {
        // Display-Assets als Image hochladen
        const exportUrl = asset.storage_path ?? asset.thumbnail_path;
        if (!exportUrl) {
          errorCount++;
          errors.push(`Asset ${asset.id}: Keine URL verfuegbar`);
          continue;
        }

        const imgAsset = await uploadImageAsset(config, {
          name: `${campaign.promo_id}_${asset.format}_${asset.language}`,
          imageUrl: exportUrl,
        });

        await markAssetExported(asset.id, "google_ads", imgAsset.id);
        successCount++;
      }
    } catch (error) {
      errorCount++;
      errors.push(`Asset ${asset.id}: ${error instanceof Error ? error.message : "Fehler"}`);
    }
  }

  return {
    platform: "google_ads",
    status: errorCount === 0 ? "completed" : successCount === 0 ? "failed" : "partial",
    successCount,
    errorCount,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

// Drive-Distribution: Komplettes Archiv erstellen
async function distributeToDrive(
  campaign: Campaign,
  assets: Asset[]
): Promise<DistributionResult> {
  const config = buildDriveWriteConfig();

  try {
    // Briefing-JSON aus Campaign zusammenstellen
    const briefing = {
      promo_id: campaign.promo_id,
      product_name: campaign.product_name,
      brand: campaign.brand,
      status: campaign.status,
      channels: campaign.channels,
      languages: campaign.languages,
      price_new: campaign.price_new,
      price_old: campaign.price_old,
      created_at: campaign.created_at,
      published_at: campaign.published_at,
    };

    // Asset-Liste fuer Drive-Upload vorbereiten
    const driveAssets = assets
      .filter((a) => a.status === "completed" && (a.storage_path ?? a.thumbnail_path))
      .map((a) => ({
        name: `${a.channel}_${a.format}_${a.language}.png`,
        url: a.storage_path ?? a.thumbnail_path ?? "",
        mimeType: "image/png",
      }));

    const result = await createCampaignArchive(config, {
      campaignName: campaign.product_name,
      promoId: campaign.promo_id,
      briefingJson: JSON.stringify(briefing, null, 2),
      assets: driveAssets,
    });

    // Alle Assets als auf Drive exportiert markieren
    for (const asset of assets.filter((a) => a.status === "completed")) {
      await markAssetExported(asset.id, "google_drive", result.folderId);
    }

    return {
      platform: "google_drive",
      status: "completed",
      successCount: result.fileCount,
      errorCount: 0,
      platformCampaignId: result.folderId,
    };
  } catch (error) {
    return {
      platform: "google_drive",
      status: "failed",
      successCount: 0,
      errorCount: assets.length,
      error: error instanceof Error ? error.message : "Drive-Archivierung fehlgeschlagen",
    };
  }
}

// Video-Asset Erkennung: Ist das Asset ein Video?
function isVideoAsset(asset: { mime_type?: string | null; generation_mode?: string; format?: string }): boolean {
  if (asset.mime_type?.startsWith("video/")) return true;
  if (asset.generation_mode === "ai_video") return true;
  return false;
}
