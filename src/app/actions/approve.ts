"use server";

import { updateCampaignStatus } from "@/lib/db/queries/campaigns";
import { logAuditEvent } from "@/lib/db/queries/audit";
import { getAuthUser } from "@/lib/auth/get-user";
import type { CampaignStatus } from "@/types/database";
import { revalidatePath } from "next/cache";

// V3 Flow: 2 Gates (Konzept, Assets). Kein separates approvals-Tabelle —
// Status-Uebergaenge in campaigns.status + Audit-Event reichen fuer 1 User.

export type Gate = "concept" | "assets";

const APPROVAL_TRANSITION: Record<Gate, { approved: CampaignStatus }> = {
  concept: { approved: "concept_approved" },
  assets: { approved: "assets_approved" },
};

interface ApprovalResult {
  success: boolean;
  error?: string;
}

// Gate genehmigen — Status-Uebergang + Audit
export async function approveStage(
  campaignId: string,
  stage: Gate
): Promise<ApprovalResult> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Nicht authentifiziert" };

    const transition = APPROVAL_TRANSITION[stage];
    if (!transition) return { success: false, error: `Unbekannte Stage: ${stage}` };

    await updateCampaignStatus(campaignId, transition.approved);
    await logAuditEvent(campaignId, `${stage}_approved`, {
      approved_by: user.id,
    });

    revalidatePath(`/campaigns/${campaignId}`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}

// Gate ablehnen — Audit-Event, Status bleibt (User regeneriert/iteriert)
export async function rejectStage(
  campaignId: string,
  stage: Gate,
  feedback?: string
): Promise<ApprovalResult> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Nicht authentifiziert" };

    await logAuditEvent(campaignId, `${stage}_rejected`, {
      rejected_by: user.id,
      feedback,
    });

    revalidatePath(`/campaigns/${campaignId}`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}
