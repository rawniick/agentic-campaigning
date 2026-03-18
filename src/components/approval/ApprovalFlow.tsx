import { CheckCircle, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Approval, ApprovalStage } from "@/types/database";

interface ApprovalFlowProps {
  approvals: Approval[];
  currentStatus?: string;
  flowVersion?: number;
}

const V1_STAGES: { key: ApprovalStage; label: string }[] = [
  { key: "concept", label: "Konzept" },
  { key: "translations", label: "Uebersetzungen" },
  { key: "assets", label: "Visuals" },
];

const V2_STAGES: { key: ApprovalStage | "eingabe" | "strategie" | "umsetzung"; label: string }[] = [
  { key: "eingabe", label: "Eingabe" },
  { key: "strategie", label: "Strategie" },
  { key: "draft_concept", label: "Grobkonzept" },
  { key: "detail_concept", label: "Detailkonzept" },
  { key: "umsetzung", label: "Umsetzung" },
];

// v2 Status → Stage-State Mapping
function getV2StageState(
  stageKey: string,
  approvals: Approval[],
  currentStatus?: string
): "approved" | "pending" | "rejected" | "revision" | "future" {
  // Spezial-Stages ohne Approval-Records
  if (stageKey === "eingabe") {
    const confirmedStatuses = [
      "input_confirmed", "strategy_proposed", "strategies_generated", "strategy_selected",
      "draft_concept_generated", "draft_concept_feedback", "draft_concept_approved",
      "detail_concept_generated", "detail_concept_feedback", "detail_concept_approved",
      "concept_approved", "translating", "translations_ready", "translations_approved",
      "rendering_assets", "assets_ready", "assets_approved", "distributing", "published",
    ];
    if (currentStatus && confirmedStatuses.includes(currentStatus)) return "approved";
    if (currentStatus === "input_review") return "pending";
    return "future";
  }

  if (stageKey === "strategie") {
    const afterStrategy = [
      "strategy_selected", "draft_concept_generated", "draft_concept_feedback",
      "draft_concept_approved", "detail_concept_generated", "detail_concept_feedback",
      "detail_concept_approved", "concept_approved", "translating", "translations_ready",
      "translations_approved", "rendering_assets", "assets_ready", "assets_approved",
      "distributing", "published",
    ];
    if (currentStatus && afterStrategy.includes(currentStatus)) return "approved";
    if (currentStatus && ["strategies_generated", "strategy_proposed"].includes(currentStatus)) return "pending";
    return "future";
  }

  if (stageKey === "umsetzung") {
    const afterDetail = [
      "translating", "translations_ready", "translations_approved",
      "rendering_assets", "assets_ready", "assets_approved",
      "distributing", "published",
    ];
    if (currentStatus && afterDetail.includes(currentStatus)) return "approved";
    if (currentStatus === "detail_concept_approved") return "pending";
    return "future";
  }

  // Approval-basierte Stages
  const approval = approvals.find((a) => a.stage === stageKey);
  if (approval?.status === "approved") return "approved";
  if (approval?.status === "pending") return "pending";
  if (approval?.status === "rejected") return "rejected";
  if (approval?.status === "revision_requested") return "revision";
  return "future";
}

export function ApprovalFlow({ approvals, currentStatus, flowVersion = 1 }: ApprovalFlowProps) {
  function getStageState(stage: ApprovalStage) {
    const approval = approvals.find((a) => a.stage === stage);
    if (approval?.status === "approved") return "approved";
    if (approval?.status === "pending") return "pending";
    if (approval?.status === "rejected") return "rejected";
    if (approval?.status === "revision_requested") return "revision";
    return "future";
  }

  const stages = flowVersion === 2 ? V2_STAGES : V1_STAGES;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {stages.map((stage, index) => {
        const state = flowVersion === 2
          ? getV2StageState(stage.key, approvals, currentStatus)
          : getStageState(stage.key as ApprovalStage);
        return (
          <div key={stage.key} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {state === "approved" && (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )}
              {state === "pending" && (
                <Clock className="h-5 w-5 text-yellow-600" />
              )}
              {state === "rejected" && (
                <Circle className="h-5 w-5 text-destructive" />
              )}
              {state === "revision" && (
                <Clock className="h-5 w-5 text-orange-500" />
              )}
              {state === "future" && (
                <Circle className="h-5 w-5 text-muted-foreground/30" />
              )}
              <span
                className={cn(
                  "text-sm",
                  state === "approved" && "font-medium text-green-600",
                  state === "pending" && "font-medium text-yellow-600",
                  state === "rejected" && "font-medium text-destructive",
                  state === "revision" && "font-medium text-orange-500",
                  state === "future" && "text-muted-foreground/50"
                )}
              >
                {stage.label}
              </span>
            </div>
            {index < stages.length - 1 && (
              <div className={cn(
                "h-px w-8",
                state === "approved" ? "bg-green-600" : "bg-muted"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
