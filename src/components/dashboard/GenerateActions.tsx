"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Languages, Layout, Image, Upload, Play, Video, Wand2, FileCheck, FileText } from "lucide-react";
import { toast } from "sonner";
import type { CampaignStatus } from "@/types/database";
import { startPipeline } from "@/app/actions/pipeline";
import Link from "next/link";

type GenerationMode = "template" | "ai_image" | "ai_video";

interface GenerateActionsProps {
  campaignId: string;
  status: CampaignStatus;
  selectedStrategyIndex?: number | null;
  flowVersion?: number;
}

export function GenerateActions({ campaignId, status, selectedStrategyIndex, flowVersion = 1 }: GenerateActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleGenerate(endpoint: string, label: string, body?: Record<string, unknown>) {
    setLoading(endpoint);
    try {
      const res = await fetch(`/api/generate/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, ...body }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(`${label} fehlgeschlagen`, {
          description: data.error ?? "Unbekannter Fehler",
        });
        return;
      }

      toast.success(`${label} erfolgreich`);
      router.refresh();
    } catch {
      toast.error(`${label} fehlgeschlagen`, {
        description: "Netzwerkfehler",
      });
    } finally {
      setLoading(null);
    }
  }

  async function handleStartPipeline() {
    setLoading("pipeline");
    try {
      const result = await startPipeline(campaignId);

      if (!result.success) {
        toast.error("Pipeline-Start fehlgeschlagen", {
          description: result.error,
        });
        return;
      }

      toast.success("Pipeline gestartet", {
        description: result.mock
          ? "Mock-Modus (n8n nicht konfiguriert)"
          : `Execution: ${result.executionId}`,
      });
      router.refresh();
    } catch {
      toast.error("Pipeline-Start fehlgeschlagen", {
        description: "Netzwerkfehler",
      });
    } finally {
      setLoading(null);
    }
  }

  const isV2 = flowVersion === 2;

  // v2 Flow Buttons
  if (isV2) {
    return (
      <div className="flex flex-wrap gap-2">
        {/* Eingabe pruefen (v2) */}
        {["draft", "input_complete", "input_review"].includes(status) && (
          <Link href={`/campaigns/${campaignId}/review`}>
            <Button variant="default">
              <FileCheck className="mr-2 h-4 w-4" />
              Eingabe pruefen
            </Button>
          </Link>
        )}

        {/* Strategie generieren (v2: nach input_confirmed) */}
        {status === "input_confirmed" && (
          <Button
            onClick={() => handleGenerate("strategy", "Strategie-Generierung")}
            disabled={loading !== null}
          >
            {loading === "strategy" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Strategie generieren
          </Button>
        )}

        {/* Grobkonzept generieren (v2) */}
        {(status === "strategy_selected" || status === "strategies_generated") && (
          <Button
            onClick={() => handleGenerate("draft-concept", "Grobkonzept-Generierung")}
            disabled={loading !== null}
          >
            {loading === "draft-concept" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Grobkonzept generieren
          </Button>
        )}

        {/* Detailkonzept generieren (v2: nach Grobkonzept-Freigabe) */}
        {status === "draft_concept_approved" && (
          <Button
            onClick={() => handleGenerate("detail-concept", "Detailkonzept-Generierung")}
            disabled={loading !== null}
          >
            {loading === "detail-concept" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Detailkonzept generieren
          </Button>
        )}

        {/* Uebersetzungen (v2: nach Detailkonzept-Freigabe) */}
        {status === "detail_concept_approved" && (
          <Button
            onClick={() => handleGenerate("translate", "Uebersetzungen")}
            disabled={loading !== null}
          >
            {loading === "translate" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Languages className="mr-2 h-4 w-4" />
            )}
            Uebersetzen
          </Button>
        )}

        {/* Concept Approved → Uebersetzen (v2 Fallback wenn concept_approved) */}
        {status === "concept_approved" && (
          <Button
            onClick={() => handleGenerate("translate", "Uebersetzungen")}
            disabled={loading !== null}
          >
            {loading === "translate" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Languages className="mr-2 h-4 w-4" />
            )}
            Uebersetzen
          </Button>
        )}

        {/* Assets generieren */}
        {status === "translations_approved" && (
          <AssetGenerateButtons
            loading={loading}
            onGenerate={(mode) =>
              handleGenerate("content", `Asset-Generierung (${mode})`, { generationMode: mode })
            }
          />
        )}

        {/* Verteilen */}
        {status === "assets_approved" && (
          <Link href={`/campaigns/${campaignId}?tab=export`}>
            <Button variant="default">
              <Upload className="mr-2 h-4 w-4" />
              Verteilen
            </Button>
          </Link>
        )}
      </div>
    );
  }

  // v1 Flow Buttons (unveraendert)
  return (
    <div className="flex flex-wrap gap-2">
      {/* Pipeline starten (automatisch) */}
      {(status === "input_complete" || status === "draft") && (
        <>
          <Button
            onClick={handleStartPipeline}
            disabled={loading !== null}
          >
            {loading === "pipeline" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Pipeline starten
          </Button>

          <Button
            variant="outline"
            onClick={() => handleGenerate("strategy", "Strategie-Generierung")}
            disabled={loading !== null}
          >
            {loading === "strategy" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Nur Strategie generieren
          </Button>
        </>
      )}

      {/* Konzept generieren */}
      {(status === "strategy_selected" || status === "strategy_proposed") && (
        <Button
          onClick={() => handleGenerate("concept", "Konzept-Generierung", {
            strategyIndex: selectedStrategyIndex ?? 0,
          })}
          disabled={loading !== null}
        >
          {loading === "concept" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Konzept generieren
        </Button>
      )}

      {/* Uebersetzungen generieren */}
      {status === "concept_approved" && (
        <Button
          onClick={() => handleGenerate("translate", "Uebersetzungen")}
          disabled={loading !== null}
        >
          {loading === "translate" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Languages className="mr-2 h-4 w-4" />
          )}
          Uebersetzen
        </Button>
      )}

      {/* Kanaladaptionen generieren */}
      {status === "concept_approved" && (
        <Button
          variant="outline"
          onClick={() => handleGenerate("channel-adapt", "Kanaladaptionen")}
          disabled={loading !== null}
        >
          {loading === "channel-adapt" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Layout className="mr-2 h-4 w-4" />
          )}
          Kanaladaptionen
        </Button>
      )}

      {/* Assets generieren */}
      {status === "translations_approved" && (
        <AssetGenerateButtons
          loading={loading}
          onGenerate={(mode) =>
            handleGenerate("content", `Asset-Generierung (${mode})`, { generationMode: mode })
          }
        />
      )}

      {/* Verteilen */}
      {status === "assets_approved" && (
        <Link href={`/campaigns/${campaignId}?tab=export`}>
          <Button variant="default">
            <Upload className="mr-2 h-4 w-4" />
            Verteilen
          </Button>
        </Link>
      )}
    </div>
  );
}

// Asset-Generierungs-Buttons mit Modus-Auswahl
function AssetGenerateButtons({
  loading,
  onGenerate,
}: {
  loading: string | null;
  onGenerate: (mode: GenerationMode) => void;
}) {
  const isLoading = loading === "content";

  const modes: { mode: GenerationMode; label: string; icon: typeof Image; variant: "default" | "outline" | "secondary" }[] = [
    { mode: "template", label: "Template (Canva)", icon: Image, variant: "default" },
    { mode: "ai_image", label: "AI-Bild", icon: Wand2, variant: "outline" },
    { mode: "ai_video", label: "AI-Video", icon: Video, variant: "outline" },
  ];

  return (
    <div className="flex items-center gap-1">
      {modes.map(({ mode, label, icon: Icon, variant }) => (
        <Button
          key={mode}
          variant={variant}
          size={mode === "template" ? "default" : "sm"}
          onClick={() => onGenerate(mode)}
          disabled={isLoading || loading !== null}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Icon className="mr-2 h-4 w-4" />
          )}
          {label}
        </Button>
      ))}
    </div>
  );
}
