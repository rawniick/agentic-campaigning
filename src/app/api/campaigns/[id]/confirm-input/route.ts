import { NextRequest, NextResponse } from "next/server";
import { getCampaignById } from "@/lib/db/queries/campaigns";
import { confirmInput } from "@/lib/db/queries/campaigns";
import { logAuditEvent } from "@/lib/db/queries/approvals";
import { getAuthUser } from "@/lib/auth/get-user";

// POST /api/campaigns/[id]/confirm-input — Input bestaetigen (v2 Flow)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { id } = await params;
    const campaign = await getCampaignById(id);

    // Validierung: Nur v2-Kampagnen im richtigen Status
    if (campaign.flow_version !== 2) {
      return NextResponse.json(
        { error: "Input-Bestaetigung nur fuer v2-Kampagnen" },
        { status: 400 }
      );
    }

    if (!["draft", "input_complete", "input_review"].includes(campaign.status)) {
      return NextResponse.json(
        { error: `Input kann im Status "${campaign.status}" nicht bestaetigt werden` },
        { status: 400 }
      );
    }

    const updated = await confirmInput(id, user.id);

    await logAuditEvent(id, "input_confirmed", {
      confirmed_by: user.id,
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
