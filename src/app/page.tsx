import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignCard } from "@/components/dashboard/CampaignCard";
import { getCampaigns } from "@/lib/db/queries/campaigns";
import { PlusCircle, Megaphone, CheckCircle, Clock } from "lucide-react";

export default async function DashboardPage() {
  let campaigns: Awaited<ReturnType<typeof getCampaigns>> = [];
  let stats = { total: 0, active: 0, approved: 0, draft: 0 };

  try {
    campaigns = await getCampaigns({ limit: 5 });
    const allCampaigns = await getCampaigns();
    stats = {
      total: allCampaigns.length,
      active: allCampaigns.filter((c) =>
        !["draft", "assets_approved"].includes(c.status)
      ).length,
      approved: allCampaigns.filter((c) => c.status === "assets_approved").length,
      draft: allCampaigns.filter((c) => c.status === "draft").length,
    };
  } catch {
    // DB nicht erreichbar - leerer State
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            ACE – Agentic Campaigning Engine
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Neue Kampagne
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gesamt</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Aktiv</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fertig</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Entwuerfe</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
          </CardContent>
        </Card>
      </div>

      {/* Letzte Kampagnen */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Letzte Kampagnen</h2>
          <Link href="/campaigns" className="text-sm text-muted-foreground hover:text-foreground">
            Alle anzeigen
          </Link>
        </div>
        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Megaphone className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-lg font-medium">Keine Kampagnen vorhanden</p>
              <p className="text-sm text-muted-foreground">
                Erstelle deine erste Kampagne um zu starten.
              </p>
              <Link href="/campaigns/new" className="mt-4">
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Neue Kampagne erstellen
                </Button>
              </Link>
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
    </div>
  );
}
