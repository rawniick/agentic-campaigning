"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormatBadge } from "./FormatBadge";
import { AlertCircle, CheckCircle, Loader2, Wand2, Video, Layout, RefreshCw } from "lucide-react";
import type { Asset, AssetGenerationMode } from "@/types/database";

const LANGUAGE_LABELS: Record<string, string> = {
  de: "DE",
  fr: "FR",
  it: "IT",
  en: "EN",
};

const STATUS_ICON: Record<string, { icon: typeof CheckCircle; className: string }> = {
  completed: { icon: CheckCircle, className: "text-green-600" },
  rendering: { icon: Loader2, className: "text-yellow-600 animate-spin" },
  processing: { icon: Loader2, className: "text-blue-600 animate-spin" },
  failed: { icon: AlertCircle, className: "text-red-600" },
};

const MODE_CONFIG: Record<AssetGenerationMode, { label: string; icon: typeof Layout; className: string }> = {
  template: { label: "Template", icon: Layout, className: "" },
  ai_image: { label: "AI-Bild", icon: Wand2, className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  ai_video: { label: "AI-Video", icon: Video, className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  text_only: { label: "Text", icon: Layout, className: "" },
};

interface AssetPreviewProps {
  asset: Asset;
  onRegenerate?: (asset: Asset) => void;
}

export function AssetPreview({ asset, onRegenerate }: AssetPreviewProps) {
  const [regenerating, setRegenerating] = useState(false);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const response = await fetch(`/api/assets/${asset.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        onRegenerate?.(asset);
      }
    } catch (err) {
      console.error("Regenerierung fehlgeschlagen:", err);
    } finally {
      setRegenerating(false);
    }
  }
  const statusConfig = STATUS_ICON[asset.status];
  const StatusIcon = statusConfig?.icon ?? CheckCircle;
  const statusClass = statusConfig?.className ?? "text-muted-foreground";
  const modeConfig = MODE_CONFIG[asset.generation_mode] ?? MODE_CONFIG.template;

  return (
    <Card className="overflow-hidden">
      {/* Thumbnail / Preview */}
      <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
        {asset.format === "text_only" ? (
          <span className="text-xs text-muted-foreground">Text-Asset (kein Bild)</span>
        ) : asset.generation_mode === "ai_video" && asset.storage_path ? (
          // AI-Video: Video-Element
          <video
            src={asset.storage_path}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            loop
            playsInline
            onMouseEnter={(e) => e.currentTarget.play()}
            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
            poster={asset.thumbnail_path ?? undefined}
          />
        ) : asset.generation_mode === "ai_image" && asset.storage_path ? (
          // AI-Bild: Tatsaechliches Bild anzeigen (data-URL oder externe URL)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.storage_path}
            alt={`${asset.channel} ${asset.format} ${asset.language}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : asset.status === "processing" ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-xs text-muted-foreground">Wird generiert...</span>
          </div>
        ) : asset.thumbnail_path ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <span className="text-xs text-muted-foreground">
              {asset.canva_design_id ? "Mock Preview" : "Kein Preview"}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Kein Preview</span>
        )}

        {/* Status-Icon oben rechts */}
        <div className="absolute top-2 right-2">
          <StatusIcon className={`h-4 w-4 ${statusClass}`} />
        </div>
      </div>

      <CardContent className="p-3 space-y-2">
        {/* Badges */}
        <div className="flex flex-wrap gap-1">
          <FormatBadge format={asset.format} />
          <Badge variant="outline">{LANGUAGE_LABELS[asset.language] ?? asset.language.toUpperCase()}</Badge>
          <Badge variant="secondary" className="capitalize">{asset.channel}</Badge>
          {/* Generation-Mode Badge (nur fuer AI-Modi anzeigen) */}
          {(asset.generation_mode === "ai_image" || asset.generation_mode === "ai_video") && (
            <Badge variant="outline" className={`gap-1 ${modeConfig.className}`}>
              <modeConfig.icon className="h-3 w-3" />
              {modeConfig.label}
            </Badge>
          )}
        </div>

        {/* AI-Provider Info */}
        {asset.ai_provider && (
          <p className="text-xs text-muted-foreground">
            Provider: {asset.ai_provider}
          </p>
        )}

        {/* Fehlermeldung bei failed */}
        {asset.status === "failed" && asset.error_message && (
          <p className="text-xs text-red-600 truncate">{asset.error_message}</p>
        )}

        {/* Processing-Hinweis */}
        {asset.status === "processing" && (
          <p className="text-xs text-blue-600">Video wird generiert...</p>
        )}

        {/* Regenerieren-Button (nur fuer AI-Assets) */}
        {(asset.generation_mode === "ai_image" || asset.generation_mode === "ai_video") && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs"
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3 w-3" />
            )}
            Regenerieren
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
