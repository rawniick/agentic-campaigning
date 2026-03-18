"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, Archive, ExternalLink, Globe, Target, HardDrive, Download } from "lucide-react";
import { toast } from "sonner";
import type { CampaignStatus, Distribution, DistributionPlatform } from "@/types/database";
import { DistributionStatus } from "./DistributionStatus";

interface ExportPanelProps {
  campaignId: string;
  status: CampaignStatus;
  distributions: Distribution[];
}

const PLATFORMS: { id: DistributionPlatform; label: string; icon: typeof Globe }[] = [
  { id: "meta", label: "Meta Ads", icon: Globe },
  { id: "google_ads", label: "Google Ads", icon: Target },
  { id: "google_drive", label: "Google Drive", icon: HardDrive },
];

export function ExportPanel({ campaignId, status, distributions }: ExportPanelProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<DistributionPlatform[]>([]);
  const [exporting, setExporting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const canExport = status === "assets_approved";
  const canArchive = ["assets_approved", "published"].includes(status);

  function togglePlatform(platform: DistributionPlatform) {
    setSelected((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  }

  async function handleExport() {
    if (selected.length === 0) {
      toast.error("Mindestens eine Plattform auswaehlen");
      return;
    }

    setExporting(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, platforms: selected }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error("Export fehlgeschlagen", { description: data.error });
        return;
      }

      if (data.success) {
        toast.success("Export erfolgreich abgeschlossen");
      } else {
        toast.error("Export teilweise fehlgeschlagen");
      }

      router.refresh();
    } catch {
      toast.error("Netzwerkfehler beim Export");
    } finally {
      setExporting(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const res = await fetch("/api/export/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error("Archivierung fehlgeschlagen", { description: data.error });
        return;
      }

      toast.success("Archivierung erfolgreich");
      router.refresh();
    } catch {
      toast.error("Netzwerkfehler bei Archivierung");
    } finally {
      setArchiving(false);
    }
  }

  // Externe Links aus vergangenen Distributions
  const driveDistribution = distributions.find(
    (d) => d.platform === "google_drive" && d.drive_folder_url
  );

  return (
    <div className="space-y-4">
      {/* Platform-Auswahl */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Plattformen auswaehlen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {PLATFORMS.map(({ id, label, icon: Icon }) => (
            <label key={id} className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={selected.includes(id)}
                onCheckedChange={() => togglePlatform(id)}
                disabled={!canExport || exporting}
              />
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{label}</span>
            </label>
          ))}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleExport}
              disabled={!canExport || exporting || selected.length === 0}
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Export starten
            </Button>

            <Button
              variant="outline"
              onClick={handleArchive}
              disabled={!canArchive || archiving}
            >
              {archiving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Archive className="mr-2 h-4 w-4" />
              )}
              Archivieren (Drive)
            </Button>
          </div>

          {/* ZIP Download */}
          <Button
            variant="outline"
            onClick={() => {
              window.open(`/api/export/download?campaignId=${campaignId}`, "_blank");
            }}
            disabled={!canArchive}
          >
            <Download className="mr-2 h-4 w-4" />
            ZIP herunterladen
          </Button>

          {!canExport && status !== "published" && status !== "archived" && (
            <p className="text-xs text-muted-foreground">
              Export erst moeglich wenn alle Assets genehmigt sind.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Distribution Status */}
      {distributions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Distribution-Status</CardTitle>
          </CardHeader>
          <CardContent>
            <DistributionStatus distributions={distributions} />
          </CardContent>
        </Card>
      )}

      {/* Externe Links */}
      {driveDistribution && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Externe Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href={driveDistribution.drive_folder_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Google Drive Archiv oeffnen
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
