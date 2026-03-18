import { notFound } from "next/navigation";
import { getCampaignById } from "@/lib/db/queries/campaigns";
import { getAssetsByCampaign } from "@/lib/db/queries/assets";
import { getDistributionsByCampaign } from "@/lib/db/queries/distributions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { ExportPanel } from "@/components/export/ExportPanel";
import { AssetGrid } from "@/components/assets/AssetGrid";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import type { Campaign } from "@/types/database";

interface ExportPageProps {
  params: Promise<{ id: string }>;
}

export default async function ExportPage({ params }: ExportPageProps) {
  const { id } = await params;

  let campaign: Campaign;
  try {
    campaign = await getCampaignById(id);
  } catch {
    notFound();
  }

  const [assets, distributions] = await Promise.all([
    getAssetsByCampaign(id).catch(() => []),
    getDistributionsByCampaign(id).catch(() => []),
  ]);

  // Assets nach Plattform gruppieren
  const socialAssets = assets.filter((a) => a.channel === "social");
  const seaAssets = assets.filter((a) => a.channel === "sea");
  const otherAssets = assets.filter((a) => !["social", "sea"].includes(a.channel));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/campaigns/${id}`} className="hover:underline">
              {campaign.promo_id}
            </Link>
            {" / Export"}
          </p>
          <h1 className="text-3xl font-bold">Export & Distribution</h1>
          <div className="mt-2">
            <StatusBadge status={campaign.status} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Linke Spalte: Export Controls */}
        <div>
          <ExportPanel
            campaignId={id}
            status={campaign.status}
            distributions={distributions}
          />
        </div>

        {/* Rechte Spalte: Asset-Uebersicht */}
        <div className="space-y-4">
          {socialAssets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Meta Ads (Social)</CardTitle>
              </CardHeader>
              <CardContent>
                <AssetGrid assets={socialAssets} />
              </CardContent>
            </Card>
          )}

          {seaAssets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Google Ads (SEA)</CardTitle>
              </CardHeader>
              <CardContent>
                <AssetGrid assets={seaAssets} />
              </CardContent>
            </Card>
          )}

          {otherAssets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Weitere Assets</CardTitle>
              </CardHeader>
              <CardContent>
                <AssetGrid assets={otherAssets} />
              </CardContent>
            </Card>
          )}

          {assets.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Keine Assets vorhanden.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Separator />

      {/* Export-History */}
      {distributions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Export-Verlauf</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {distributions.map((dist) => (
                <div key={dist.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <div>
                    <span className="font-medium">{dist.platform}</span>
                    <span className="text-muted-foreground ml-2">
                      {dist.success_count}/{dist.asset_count} Assets
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={
                      dist.status === "completed" ? "text-green-600" :
                      dist.status === "failed" ? "text-red-600" :
                      "text-muted-foreground"
                    }>
                      {dist.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(dist.created_at).toLocaleString("de-CH")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
