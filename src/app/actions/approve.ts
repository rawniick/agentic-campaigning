"use server";

import { getPendingApproval, resolveApproval, logAuditEvent } from "@/lib/db/queries/approvals";
import { updateCampaignStatus } from "@/lib/db/queries/campaigns";
import { resumeN8nWait } from "@/lib/integrations/n8n";
import { getAuthUser } from "@/lib/auth/get-user";
import type { ApprovalStage, CampaignStatus } from "@/types/database";
import type { N8nWaitStage } from "@/lib/integrations/n8n";
import { revalidatePath } from "next/cache";

// Status-Uebergaenge nach Approval
const APPROVAL_STATUS_MAP: Record<ApprovalStage, { approved: CampaignStatus; rejected: CampaignStatus }> = {
  concept: {
    approved: "concept_approved",
    rejected: "strategy_selected", // Zurueck zur Neugenerierung
  },
  translations: {
    approved: "translations_approved",
    rejected: "concept_approved", // Zurueck zum Konzept
  },
  assets: {
    approved: "assets_approved",
    rejected: "translations_approved", // Zurueck zu Uebersetzungen
  },
  // v2 Flow
  draft_concept: {
    approved: "draft_concept_approved",
    rejected: "strategy_selected", // Zurueck zur Strategie
  },
  detail_concept: {
    approved: "detail_concept_approved",
    rejected: "draft_concept_approved", // Zurueck zum Grobkonzept
  },
};

// Mapping: ApprovalStage -> n8n Wait-Node Stage
const APPROVAL_TO_N8N_STAGE: Partial<Record<ApprovalStage, N8nWaitStage>> = {
  concept: "concept",
  translations: "translations",
  assets: "assets",
  // v2 Flow: Grobkonzept + Detailkonzept Gates
  draft_concept: "draft_concept",
  detail_concept: "detail_concept",
};

interface ApprovalResult {
  success: boolean;
  error?: string;
}

// Stufe genehmigen
export async function approveStage(
  campaignId: string,
  stage: ApprovalStage
): Promise<ApprovalResult> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Nicht authentifiziert" };
    const approvedBy = user.id;

    const pending = await getPendingApproval(campaignId, stage);
    if (!pending) {
      return { success: false, error: `Kein offenes Approval fuer Stage "${stage}"` };
    }

    await resolveApproval(pending.id, "approved", approvedBy);
    const nextStatus = APPROVAL_STATUS_MAP[stage].approved;
    await updateCampaignStatus(campaignId, nextStatus);

    await logAuditEvent(campaignId, `${stage}_approved`, {
      approval_id: pending.id,
      approved_by: approvedBy,
    });

    // n8n Resume: Wait-Node fuer diese Stage fortsetzen
    try {
      const n8nStage = APPROVAL_TO_N8N_STAGE[stage];
      if (n8nStage) {
        await resumeN8nWait(campaignId, n8nStage, {
          stage,
          action: "approved",
          campaignId,
        });
      }
    } catch {
      // n8n-Resume ist optional, Fehler nicht propagieren
    }

    revalidatePath(`/campaigns/${campaignId}`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}

// Stufe ablehnen
export async function rejectStage(
  campaignId: string,
  stage: ApprovalStage,
  feedback?: string
): Promise<ApprovalResult> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Nicht authentifiziert" };
    const rejectedBy = user.id;

    const pending = await getPendingApproval(campaignId, stage);
    if (!pending) {
      return { success: false, error: `Kein offenes Approval fuer Stage "${stage}"` };
    }

    await resolveApproval(pending.id, "rejected", rejectedBy, feedback);
    const prevStatus = APPROVAL_STATUS_MAP[stage].rejected;
    await updateCampaignStatus(campaignId, prevStatus);

    await logAuditEvent(campaignId, `${stage}_rejected`, {
      approval_id: pending.id,
      rejected_by: rejectedBy,
      feedback,
    });

    // n8n Resume mit Rejection-Signal: Workflow kann darauf reagieren
    try {
      const n8nStage = APPROVAL_TO_N8N_STAGE[stage];
      if (n8nStage) {
        await resumeN8nWait(campaignId, n8nStage, {
          stage,
          action: "rejected",
          campaignId,
          feedback,
        });
      }
    } catch {
      // n8n-Resume ist optional
    }

    revalidatePath(`/campaigns/${campaignId}`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}

// Ueberarbeitung anfragen
export async function requestRevision(
  campaignId: string,
  stage: ApprovalStage,
  feedback: string
): Promise<ApprovalResult> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Nicht authentifiziert" };
    const requestedBy = user.id;

    const pending = await getPendingApproval(campaignId, stage);
    if (!pending) {
      return { success: false, error: `Kein offenes Approval fuer Stage "${stage}"` };
    }

    await resolveApproval(pending.id, "revision_requested", requestedBy, feedback);

    // Bei Revision zurueck zum vorherigen Status (gleich wie Rejection)
    const prevStatus = APPROVAL_STATUS_MAP[stage].rejected;
    await updateCampaignStatus(campaignId, prevStatus);

    await logAuditEvent(campaignId, `${stage}_revision_requested`, {
      approval_id: pending.id,
      requested_by: requestedBy,
      feedback,
    });

    // n8n Resume mit Revision-Signal
    try {
      const n8nStage = APPROVAL_TO_N8N_STAGE[stage];
      if (n8nStage) {
        await resumeN8nWait(campaignId, n8nStage, {
          stage,
          action: "revision_requested",
          campaignId,
          feedback,
        });
      }
    } catch {
      // n8n-Resume ist optional
    }

    revalidatePath(`/campaigns/${campaignId}`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}
