import { NextRequest, NextResponse } from "next/server";
import { getCampaignById, updateCampaignStatus } from "@/lib/db/queries/campaigns";
import { getPendingApproval, resolveApproval, createApproval, logAuditEvent } from "@/lib/db/queries/approvals";
import { getAuthUser } from "@/lib/auth/get-user";
import type { CampaignStatus } from "@/types/database";

// Status-Uebergaenge fuer v2 Phasen
const PHASE_STATUS_MAP: Record<string, { approved: CampaignStatus; rejected: CampaignStatus }> = {
  draft_concept: {
    approved: "draft_concept_approved",
    rejected: "strategy_selected",
  },
  detail_concept: {
    approved: "detail_concept_approved",
    rejected: "draft_concept_approved",
  },
};

// POST /api/campaigns/[id]/approve-phase — Phase genehmigen (v2 Flow)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { id } = await params;
    const { phase, action } = await request.json();

    if (!phase || !["draft_concept", "detail_concept"].includes(phase)) {
      return NextResponse.json({ error: "Ungueltige Phase" }, { status: 400 });
    }

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Ungueltige Aktion (approve/reject)" }, { status: 400 });
    }

    const campaign = await getCampaignById(id);
    if (campaign.flow_version !== 2) {
      return NextResponse.json({ error: "Nur fuer v2-Kampagnen" }, { status: 400 });
    }

    // Pending Approval finden oder erstellen
    let pending = await getPendingApproval(id, phase as "draft_concept" | "detail_concept");
    if (!pending) {
      // Falls kein Pending existiert (z.B. nach Feedback-Loop), neues erstellen + sofort resolven
      pending = await createApproval(id, phase as "draft_concept" | "detail_concept");
    }

    const statusMap = PHASE_STATUS_MAP[phase];
    if (action === "approve") {
      await resolveApproval(pending.id, "approved", user.id);
      await updateCampaignStatus(id, statusMap.approved);
      await logAuditEvent(id, `${phase}_approved`, {
        approval_id: pending.id,
        approved_by: user.id,
      });
    } else {
      await resolveApproval(pending.id, "rejected", user.id);
      await updateCampaignStatus(id, statusMap.rejected);
      await logAuditEvent(id, `${phase}_rejected`, {
        approval_id: pending.id,
        rejected_by: user.id,
      });
    }

    return NextResponse.json({ success: true, status: action === "approve" ? statusMap.approved : statusMap.rejected });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
