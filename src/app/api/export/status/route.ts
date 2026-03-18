import { NextResponse } from "next/server";
import { getDistributionsByCampaign } from "@/lib/db/queries/distributions";
import { getAssetsByCampaign } from "@/lib/db/queries/assets";
import { getAuthUser } from "@/lib/auth/get-user";

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");

    if (!campaignId) {
      return NextResponse.json(
        { error: "campaignId Parameter fehlt" },
        { status: 400 }
      );
    }

    const [distributions, assets] = await Promise.all([
      getDistributionsByCampaign(campaignId),
      getAssetsByCampaign(campaignId),
    ]);

    // Asset-Export Status aggregieren
    const exportedAssets = assets.filter((a) => a.exported_at !== null);
    const exportSummary = {
      total: assets.length,
      exported: exportedAssets.length,
      platforms: {} as Record<string, number>,
    };

    for (const asset of exportedAssets) {
      if (asset.exported_to) {
        for (const platform of Object.keys(asset.exported_to)) {
          exportSummary.platforms[platform] = (exportSummary.platforms[platform] ?? 0) + 1;
        }
      }
    }

    return NextResponse.json({
      distributions,
      exportSummary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
