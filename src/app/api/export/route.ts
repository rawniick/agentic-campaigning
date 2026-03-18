import { NextResponse } from "next/server";
import { z } from "zod";
import { getCampaignById, updateCampaignStatus } from "@/lib/db/queries/campaigns";
import { getAssetsByCampaign } from "@/lib/db/queries/assets";
import { logAuditEvent } from "@/lib/db/queries/approvals";
import { distributeCampaign } from "@/lib/integrations/distribution";
import type { DistributionPlatform } from "@/types/database";

const ExportSchema = z.object({
  campaignId: z.string().uuid(),
  platforms: z.array(
    z.enum(["meta", "google_ads", "google_drive"])
  ).min(1),
});

// Interne API-Key Auth (fuer Server Actions und n8n)
function validateExportAuth(request: Request): boolean {
  const apiKey = request.headers.get("x-api-key");
  const n8nKey = process.env.N8N_API_KEY;
  // Erlaubt: interner Call ohne Key (Server Action), oder gueltiger API-Key
  const isInternalCall = request.headers.get("x-internal") === "true";
  if (isInternalCall) return true;
  if (n8nKey && apiKey === n8nKey) return true;
  return false;
}

export async function POST(request: Request) {
  if (!validateExportAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = ExportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ungueltige Eingabe", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { campaignId, platforms } = parsed.data;

    // Kampagne laden und Status pruefen
    const campaign = await getCampaignById(campaignId);
    if (campaign.status !== "assets_approved") {
      return NextResponse.json(
        { error: `Export nur bei Status "assets_approved" moeglich. Aktuell: ${campaign.status}` },
        { status: 400 }
      );
    }

    // Assets laden
    const assets = await getAssetsByCampaign(campaignId);
    if (assets.length === 0) {
      return NextResponse.json(
        { error: "Keine Assets vorhanden" },
        { status: 400 }
      );
    }

    // Status auf "distributing" setzen
    await updateCampaignStatus(campaignId, "distributing");

    await logAuditEvent(campaignId, "distribution_started", {
      platforms,
      asset_count: assets.length,
    });

    // Distribution starten
    const results = await distributeCampaign(
      campaign,
      assets,
      platforms as DistributionPlatform[]
    );

    // Ergebnis auswerten
    const allSuccess = results.every((r) => r.status === "completed");
    const allFailed = results.every((r) => r.status === "failed");

    if (allSuccess) {
      await updateCampaignStatus(campaignId, "published", { published_at: new Date().toISOString() });
      await logAuditEvent(campaignId, "distribution_completed", { results });
    } else if (allFailed) {
      // Zurueck zu assets_approved bei komplettem Fehler
      await updateCampaignStatus(campaignId, "assets_approved");
      await logAuditEvent(campaignId, "distribution_failed", { results });
    } else {
      // Partial: als published markieren mit Warnung
      await updateCampaignStatus(campaignId, "published", { published_at: new Date().toISOString() });
      await logAuditEvent(campaignId, "distribution_partial", { results });
    }

    return NextResponse.json({
      success: !allFailed,
      results,
      status: allSuccess ? "published" : allFailed ? "assets_approved" : "published",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
