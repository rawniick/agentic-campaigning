import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CampaignCard } from "@/components/dashboard/CampaignCard";
import { CampaignFilters } from "@/components/dashboard/CampaignFilters";
import { getCampaigns } from "@/lib/db/queries/campaigns";
import { PlusCircle, Megaphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { CampaignStatus } from "@/types/database";

interface CampaignsPageProps {
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const params = await searchParams;
  let campaigns: Awaited<ReturnType<typeof getCampaigns>> = [];

  try {
    campaigns = await getCampaigns({
      status: params.status as CampaignStatus | undefined,
    });

    // Client-seitige Suche simulieren (Supabase hat kein Full-Text Search out-of-box)
    if (params.q) {
      const query = params.q.toLowerCase();
      campaigns = campaigns.filter(
        (c) =>
          c.product_name.toLowerCase().includes(query) ||
          c.promo_id.toLowerCase().includes(query) ||
          c.brand.toLowerCase().includes(query)
      );
    }
  } catch {
    // DB nicht erreichbar
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Kampagnen</h1>
        <Link href="/campaigns/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Neue Kampagne
          </Button>
        </Link>
      </div>

      {/* Filter */}
      <CampaignFilters />

      {/* Liste */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Megaphone className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-lg font-medium">Keine Kampagnen gefunden</p>
            <p className="text-sm text-muted-foreground">
              {params.status || params.q
                ? "Versuche andere Filterkriterien."
                : "Erstelle deine erste Kampagne."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}
