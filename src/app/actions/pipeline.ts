"use server";

import { getCampaignById, updateCampaign } from "@/lib/db/queries/campaigns";
import { logAuditEvent } from "@/lib/db/queries/approvals";
import { startCampaignPipeline } from "@/lib/integrations/n8n";
import { getAuthUser } from "@/lib/auth/get-user";
import { revalidatePath } from "next/cache";

interface PipelineResult {
  success: boolean;
  executionId?: string;
  mock?: boolean;
  error?: string;
}

/**
 * n8n Master-Pipeline fuer eine Kampagne starten.
 * Voraussetzung: Campaign muss im Status "draft" oder "input_complete" sein.
 * Speichert die Execution-ID in der Campaign.
 */
export async function startPipeline(campaignId: string): Promise<PipelineResult> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Nicht authentifiziert" };

    const campaign = await getCampaignById(campaignId);

    // Nur aus fruehen Status starten
    if (!["draft", "input_complete"].includes(campaign.status)) {
      return {
        success: false,
        error: `Pipeline kann nicht im Status "${campaign.status}" gestartet werden. Erwartet: draft oder input_complete`,
      };
    }

    // n8n Pipeline triggern
    const result = await startCampaignPipeline(campaignId);

    // Execution-ID in Campaign speichern
    await updateCampaign(campaignId, {
      n8n_execution_id: result.executionId,
    });

    await logAuditEvent(campaignId, "pipeline_started", {
      execution_id: result.executionId,
      mock: result.mock,
      started_by: user.id,
    });

    revalidatePath(`/campaigns/${campaignId}`);

    return {
      success: true,
      executionId: result.executionId,
      mock: result.mock,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}
