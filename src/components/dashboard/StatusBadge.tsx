import { Badge } from "@/components/ui/badge";
import type { CampaignStatus } from "@/types/database";

const STATUS_CONFIG: Record<CampaignStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Entwurf", variant: "outline" },
  input_complete: { label: "Input komplett", variant: "secondary" },
  strategy_proposed: { label: "Strategie vorgeschlagen", variant: "secondary" },
  strategy_selected: { label: "Strategie gewaehlt", variant: "default" },
  concept_generated: { label: "Konzept generiert", variant: "default" },
  concept_approved: { label: "Konzept genehmigt", variant: "default" },
  translating: { label: "Wird uebersetzt...", variant: "secondary" },
  translations_ready: { label: "Uebersetzungen fertig", variant: "default" },
  translations_approved: { label: "Uebersetzungen genehmigt", variant: "default" },
  rendering_assets: { label: "Assets werden erstellt...", variant: "secondary" },
  assets_ready: { label: "Assets fertig", variant: "default" },
  assets_approved: { label: "Assets genehmigt", variant: "default" },
  distributing: { label: "Wird verteilt...", variant: "secondary" },
  published: { label: "Publiziert", variant: "default" },
  archived: { label: "Archiviert", variant: "outline" },
  // v2 Flow
  input_review: { label: "Eingabe pruefen", variant: "outline" },
  input_confirmed: { label: "Eingabe bestaetigt", variant: "secondary" },
  strategies_generated: { label: "Strategien generiert", variant: "secondary" },
  draft_concept_generated: { label: "Grobkonzept generiert", variant: "default" },
  draft_concept_feedback: { label: "Grobkonzept Feedback", variant: "secondary" },
  draft_concept_approved: { label: "Grobkonzept freigegeben", variant: "default" },
  detail_concept_generated: { label: "Detailkonzept generiert", variant: "default" },
  detail_concept_feedback: { label: "Detailkonzept Feedback", variant: "secondary" },
  detail_concept_approved: { label: "Detailkonzept freigegeben", variant: "default" },
};

interface StatusBadgeProps {
  status: CampaignStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
