import { NextResponse } from "next/server";
import { z } from "zod";
import { getCampaignById, updateCampaignStatus } from "@/lib/db/queries/campaigns";
import { getAssetsByCampaign } from "@/lib/db/queries/assets";
import { logAuditEvent } from "@/lib/db/queries/approvals";
import { distributeCampaign } from "@/lib/integrations/distribution";

const ArchiveSchema = z.object({
  campaignId: z.string().uuid(),
});

export async function POST(request: Request) {
  // Auth: interner Call oder API-Key
  const apiKey = request.headers.get("x-api-key");
  const n8nKey = process.env.N8N_API_KEY;
  const isInternalCall = request.headers.get("x-internal") === "true";
  if (!isInternalCall && !(n8nKey && apiKey === n8nKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = ArchiveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ungueltige Eingabe", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { campaignId } = parsed.data;

    // Kampagne laden
    const campaign = await getCampaignById(campaignId);
    if (!["assets_approved", "published", "distributing"].includes(campaign.status)) {
      return NextResponse.json(
        { error: `Archivierung nicht moeglich bei Status "${campaign.status}"` },
        { status: 400 }
      );
    }

    const assets = await getAssetsByCampaign(campaignId);

    await logAuditEvent(campaignId, "archive_started", {
      asset_count: assets.length,
    });

    // Nur Drive-Distribution ausfuehren
    const results = await distributeCampaign(campaign, assets, ["google_drive"]);
    const driveResult = results[0];

    if (driveResult && driveResult.status === "completed") {
      await updateCampaignStatus(campaignId, "archived");
      await logAuditEvent(campaignId, "archive_completed", {
        folder_id: driveResult.platformCampaignId,
      });
    } else {
      await logAuditEvent(campaignId, "archive_failed", {
        error: driveResult?.error,
      });
    }

    return NextResponse.json({
      success: driveResult?.status === "completed",
      result: driveResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
