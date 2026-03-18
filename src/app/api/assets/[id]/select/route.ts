import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/db/supabase";
import { updateCampaign } from "@/lib/db/queries/campaigns";
import { logAuditEvent } from "@/lib/db/queries/approvals";
import { getAuthUser } from "@/lib/auth/get-user";

// POST /api/assets/[id]/select — Hero-Kandidat auswaehlen
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { id: assetId } = await params;
    const db = await getServerClient();

    // Asset laden + candidate_group_id pruefen
    const { data: asset, error: assetError } = await db
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: "Asset nicht gefunden" }, { status: 404 });
    }

    if (!asset.candidate_group_id) {
      return NextResponse.json({ error: "Asset ist kein Kandidat" }, { status: 400 });
    }

    // Alle anderen Kandidaten der Gruppe deselektieren
    await db
      .from("assets")
      .update({ is_selected_candidate: false })
      .eq("candidate_group_id", asset.candidate_group_id);

    // Diesen Kandidaten selektieren
    await db
      .from("assets")
      .update({ is_selected_candidate: true })
      .eq("id", assetId);

    // Campaign hero_image_asset_id setzen
    await updateCampaign(asset.campaign_id, {
      hero_image_asset_id: assetId,
    });

    await logAuditEvent(asset.campaign_id, "hero_image_selected", {
      asset_id: assetId,
      candidate_group_id: asset.candidate_group_id,
    });

    return NextResponse.json({ success: true, selectedAssetId: assetId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
