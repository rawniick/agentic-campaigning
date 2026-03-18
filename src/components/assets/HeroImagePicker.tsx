"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2, ImagePlus, RefreshCw } from "lucide-react";
import type { Asset } from "@/types/database";

interface HeroImagePickerProps {
  campaignId: string;
  candidates: Asset[];
  selectedAssetId?: string | null;
  onSelect?: (assetId: string) => void;
  onGenerate?: () => void;
}

export function HeroImagePicker({
  campaignId,
  candidates,
  selectedAssetId,
  onSelect,
  onGenerate,
}: HeroImagePickerProps) {
  const [selecting, setSelecting] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function handleSelect(assetId: string) {
    setSelecting(assetId);
    try {
      const response = await fetch(`/api/assets/${assetId}/select`, {
        method: "POST",
      });
      if (response.ok) {
        onSelect?.(assetId);
      }
    } catch (err) {
      console.error("Hero-Auswahl fehlgeschlagen:", err);
    } finally {
      setSelecting(null);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const response = await fetch("/api/generate/hero-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      if (response.ok) {
        onGenerate?.();
      }
    } catch (err) {
      console.error("Hero-Generierung fehlgeschlagen:", err);
    } finally {
      setGenerating(false);
    }
  }

  if (candidates.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-4">
          <ImagePlus className="h-12 w-12 mx-auto text-muted-foreground" />
          <div>
            <h3 className="font-semibold">Hero-Bild waehlen</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Generiere 3 Hero-Bild-Kandidaten und waehle das beste aus.
            </p>
          </div>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generiere Kandidaten...
              </>
            ) : (
              <>
                <ImagePlus className="mr-2 h-4 w-4" />
                Hero-Bilder generieren
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Hero-Bild auswaehlen</h3>
          <p className="text-sm text-muted-foreground">
            Waehle eines der generierten Hero-Bilder fuer die Kampagne.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Neue generieren</span>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {candidates.map((candidate) => {
          const isSelected = candidate.id === selectedAssetId || candidate.is_selected_candidate;
          const isSelecting = selecting === candidate.id;

          return (
            <Card
              key={candidate.id}
              className={`overflow-hidden cursor-pointer transition-all ${
                isSelected
                  ? "ring-2 ring-primary shadow-lg"
                  : "hover:shadow-md"
              }`}
              onClick={() => !isSelecting && handleSelect(candidate.id)}
            >
              <div className="relative aspect-video bg-muted">
                {candidate.storage_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={candidate.storage_url ?? candidate.storage_path}
                    alt={`Hero-Kandidat`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}

                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <Badge className="gap-1 bg-primary">
                      <CheckCircle className="h-3 w-3" />
                      Ausgewaehlt
                    </Badge>
                  </div>
                )}
              </div>

              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {candidate.ai_provider ?? "AI"}
                  </span>
                  {isSelecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : !isSelected ? (
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      Auswaehlen
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
