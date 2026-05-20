import { Badge } from "@/components/ui/badge";
import type { CampaignStatus } from "@/types/database";

const STATUS_CONFIG: Record<CampaignStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Entwurf", variant: "outline" },
  input_complete: { label: "Eingabe komplett", variant: "secondary" },
  concept_generated: { label: "Konzept generiert", variant: "default" },
  concept_feedback: { label: "Konzept Feedback", variant: "secondary" },
  concept_approved: { label: "Konzept freigegeben", variant: "default" },
  translating: { label: "Wird uebersetzt...", variant: "secondary" },
  translations_ready: { label: "Uebersetzungen fertig", variant: "default" },
  rendering_assets: { label: "Assets werden erstellt...", variant: "secondary" },
  assets_ready: { label: "Assets fertig", variant: "default" },
  assets_approved: { label: "Assets freigegeben", variant: "default" },
};

interface StatusBadgeProps {
  status: CampaignStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
