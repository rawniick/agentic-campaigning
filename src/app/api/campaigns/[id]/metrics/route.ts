import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/db/supabase";
import { getAuthUser } from "@/lib/auth/get-user";

// GET /api/campaigns/[id]/metrics — Performance-Daten abrufen
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { id: campaignId } = await params;
    const db = await getServerClient();

    const { data: metrics, error } = await db
      .from("campaign_metrics")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("date", { ascending: false });

    if (error) throw new Error(`Metriken laden fehlgeschlagen: ${error.message}`);

    // Aggregierte Zusammenfassung
    const summary = {
      total_impressions: 0,
      total_clicks: 0,
      total_spend_chf: 0,
      total_conversions: 0,
      avg_ctr: 0,
      platforms: new Set<string>(),
    };

    for (const m of metrics ?? []) {
      summary.total_impressions += Number(m.impressions ?? 0);
      summary.total_clicks += Number(m.clicks ?? 0);
      summary.total_spend_chf += Number(m.spend_chf ?? 0);
      summary.total_conversions += Number(m.conversions ?? 0);
      summary.platforms.add(m.platform);
    }

    if (summary.total_impressions > 0) {
      summary.avg_ctr = summary.total_clicks / summary.total_impressions;
    }

    return NextResponse.json({
      metrics: metrics ?? [],
      summary: {
        ...summary,
        platforms: Array.from(summary.platforms),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
