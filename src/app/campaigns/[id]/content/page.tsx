import { notFound } from "next/navigation";
import { getCampaignById } from "@/lib/db/queries/campaigns";
import { getAssetsByCampaign } from "@/lib/db/queries/assets";
import { AssetGrid } from "@/components/assets/AssetGrid";
import { HeroImagePicker } from "@/components/assets/HeroImagePicker";
import { GenerationProgress } from "@/components/assets/GenerationProgress";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import Link from "next/link";
import type { Campaign } from "@/types/database";

interface ContentPageProps {
  params: Promise<{ id: string }>;
}

export default async function ContentPage({ params }: ContentPageProps) {
  const { id } = await params;

  let campaign: Campaign;
  try {
    campaign = await getCampaignById(id);
  } catch {
    notFound();
  }

  const assets = await getAssetsByCampaign(id).catch(() => []);

  // Hero-Kandidaten (candidate_group_id) von regulaeren Assets trennen
  const heroCandidates = assets.filter((a) => a.candidate_group_id !== null);
  const regularAssets = assets.filter((a) => a.candidate_group_id === null);

  const completedAssets = regularAssets.filter((a) => a.status === "completed").length;
  const processingAssets = regularAssets.filter((a) => a.status === "processing").length;
  const failedAssets = regularAssets.filter((a) => a.status === "failed").length;

  const canGenerate = campaign.status === "translations_ready";
  const hasAssets = regularAssets.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/campaigns/${id}`} className="hover:underline">
              {campaign.promo_id}
            </Link>
            {" / Content"}
          </p>
          <h1 className="text-3xl font-bold">Content Assets</h1>
          <div className="mt-2 flex items-center gap-3">
            <StatusBadge status={campaign.status} />
          </div>
        </div>
        <div className="text-right text-sm text-muted-foreground space-y-1">
          <p>{regularAssets.length} Assets total</p>
          <p>{completedAssets} fertig</p>
          {processingAssets > 0 && (
            <p className="text-blue-600">{processingAssets} in Generierung</p>
          )}
          {failedAssets > 0 && (
            <p className="text-red-600">{failedAssets} fehlgeschlagen</p>
          )}
        </div>
      </div>

      {/* Step 1: Hero-Bild Auswahl */}
      <HeroImagePicker
        campaignId={id}
        candidates={heroCandidates}
        selectedAssetId={campaign.hero_image_asset_id}
      />

      {/* Step 2: Asset-Generierung mit Streaming */}
      {canGenerate && !hasAssets && (
        <GenerationProgress campaignId={id} />
      )}

      {/* Step 3: Asset Grid mit Regenerierung */}
      {hasAssets && (
        <AssetGrid assets={regularAssets} />
      )}

      {/* Zurueck-Link */}
      <div className="text-sm">
        <Link href={`/campaigns/${id}`} className="text-muted-foreground hover:underline">
          Zurueck zur Kampagne
        </Link>
      </div>
    </div>
  );
}
