import { NextRequest, NextResponse } from "next/server";
import { getCampaignById, updateCampaign } from "@/lib/db/queries/campaigns";
import { logAuditEvent } from "@/lib/db/queries/approvals";
import { resumeN8nWait } from "@/lib/integrations/n8n";
import { getAuthUser } from "@/lib/auth/get-user";

// GET /api/campaigns/[id] - Einzelne Kampagne lesen
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { id } = await params;
    const campaign = await getCampaignById(id);
    return NextResponse.json(campaign);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    const status = message.includes("nicht gefunden") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// Erlaubte Felder fuer PATCH-Updates (Whitelist)
const ALLOWED_PATCH_FIELDS = new Set([
  "status", "product_name", "product_type", "product_features", "product_network",
  "price_old", "price_new", "price_suffix", "discount_type", "discount_value",
  "discount_display", "discount_duration", "price_conditions",
  "start_date", "end_date", "target_audiences", "business_goal",
  "claim_direction", "campaign_narrative", "channels", "languages",
  "disclaimer_text", "five_g_badge", "swisscom_netz_hinweis", "legal_review_required",
  "restrictions", "strategy_options", "selected_strategy_index",
]);

// PATCH /api/campaigns/[id] - Kampagne updaten (nur erlaubte Felder)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    // Nur erlaubte Felder durchlassen
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_PATCH_FIELDS.has(key)) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Keine gueltigen Felder zum Updaten" }, { status: 400 });
    }

    const campaign = await updateCampaign(id, updates);

    // n8n Resume: Wenn Strategie ausgewaehlt wurde, Wait-Node fortsetzen
    if (updates.status === "strategy_selected" && updates.selected_strategy_index !== undefined) {
      try {
        await resumeN8nWait(id, "strategy", {
          action: "strategy_selected",
          campaignId: id,
          strategyIndex: updates.selected_strategy_index,
        });
        await logAuditEvent(id, "n8n_strategy_resumed", {
          selected_strategy_index: updates.selected_strategy_index,
        });
      } catch {
        // n8n-Resume ist optional, Fehler nicht propagieren
      }
    }

    return NextResponse.json(campaign);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
