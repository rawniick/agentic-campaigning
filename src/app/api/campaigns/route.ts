import { NextRequest, NextResponse } from "next/server";
import { promoInputSchema } from "@/lib/schemas/promo-input";
import { mapPromoInputToCampaign } from "@/lib/mappers/promo-to-campaign";
import { createCampaign, getCampaigns } from "@/lib/db/queries/campaigns";
import { logAuditEvent } from "@/lib/db/queries/audit";
import { getAuthUser } from "@/lib/auth/get-user";

// POST /api/campaigns - Kampagne aus PromoInput erstellen
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const body = await request.json();
    const parsed = promoInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validierung fehlgeschlagen", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const campaignData = mapPromoInputToCampaign(parsed.data);
    const campaign = await createCampaign(campaignData);

    await logAuditEvent(campaign.id, "campaign_created", {
      promo_id: campaign.promo_id,
      brand: campaign.brand,
      created_by: user.id,
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/campaigns - Kampagnen-Liste abrufen
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as Parameters<typeof getCampaigns>[0] extends { status?: infer S } ? S : never;
    const limit = searchParams.get("limit");

    const campaigns = await getCampaigns({
      status: status || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return NextResponse.json(campaigns);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
