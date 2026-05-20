"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Languages, Image, Download, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { approveStage } from "@/app/actions/approve";
import type { CampaignStatus } from "@/types/database";

interface GenerateActionsProps {
  campaignId: string;
  status: CampaignStatus;
}

// V3 Flow: Manuelle Trigger pro Stage. 2 Approval-Gates (Konzept, Assets).
export function GenerateActions({ campaignId, status }: GenerateActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleGenerate(endpoint: string, label: string) {
    setLoading(endpoint);
    try {
      const res = await fetch(`/api/generate/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(`${label} fehlgeschlagen`, { description: data.error ?? "Unbekannter Fehler" });
        return;
      }
      toast.success(`${label} erfolgreich`);
      router.refresh();
    } catch {
      toast.error(`${label} fehlgeschlagen`, { description: "Netzwerkfehler" });
    } finally {
      setLoading(null);
    }
  }

  async function handleApprove(stage: "concept" | "assets", label: string) {
    setLoading(`approve-${stage}`);
    try {
      const result = await approveStage(campaignId, stage);
      if (!result.success) {
        toast.error("Freigabe fehlgeschlagen", { description: result.error });
        return;
      }
      toast.success(`${label} freigegeben`);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  function handleDownload() {
    window.open(`/api/export/download?campaignId=${campaignId}`, "_blank");
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Step 1: Konzept generieren */}
      {(status === "input_complete" || status === "draft") && (
        <Button
          onClick={() => handleGenerate("concept", "Konzept-Generierung")}
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

      {/* Gate 1: Konzept freigeben (alternativ zu FeedbackChat-Approve) */}
      {(status === "concept_generated" || status === "concept_feedback") && (
        <Button
          onClick={() => handleApprove("concept", "Konzept")}
          disabled={loading !== null}
          variant="default"
        >
          {loading === "approve-concept" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Konzept freigeben
        </Button>
      )}

      {/* Step 2: Uebersetzen (auto nach Konzept-Approve, manuell triggern) */}
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

      {/* Step 3: Assets generieren (channel-driven, kein Modus-Picker) */}
      {status === "translations_ready" && (
        <Button
          onClick={() => handleGenerate("content", "Asset-Generierung")}
          disabled={loading !== null}
        >
          {loading === "content" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Image className="mr-2 h-4 w-4" />
          )}
          Assets generieren
        </Button>
      )}

      {/* Gate 2: Assets freigeben */}
      {status === "assets_ready" && (
        <Button
          onClick={() => handleApprove("assets", "Assets")}
          disabled={loading !== null}
          variant="default"
        >
          {loading === "approve-assets" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Assets freigeben
        </Button>
      )}

      {/* Step 4: ZIP herunterladen */}
      {status === "assets_approved" && (
        <Button onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          ZIP herunterladen
        </Button>
      )}
    </div>
  );
}
