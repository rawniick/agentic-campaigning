"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";
import type { CampaignStatus } from "@/types/database";

interface ExportPanelProps {
  campaignId: string;
  status: CampaignStatus;
}

// V3: Nur ZIP-Download. Auto-Distribution an Meta/Google Ads wurde entfernt
// — User laedt Assets manuell auf den Ad-Plattformen hoch.
export function ExportPanel({ campaignId, status }: ExportPanelProps) {
  const canDownload = ["assets_approved", "assets_ready"].includes(status);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Export</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Alle Assets + Briefing als ZIP herunterladen, danach selbst in
          Meta / Google Ads / CRM hochladen.
        </p>
        <Button
          onClick={() => window.open(`/api/export/download?campaignId=${campaignId}`, "_blank")}
          disabled={!canDownload}
        >
          <Download className="mr-2 h-4 w-4" />
          ZIP herunterladen
        </Button>
        {!canDownload && (
          <p className="text-xs text-muted-foreground">
            Download verfuegbar wenn Assets fertig sind.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
