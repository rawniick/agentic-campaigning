import { getServerClient, type SupabaseClient } from "../supabase";

export interface CampaignMetric {
  id: string;
  campaign_id: string;
  platform: string;
  date: string;
  impressions: number;
  clicks: number;
  spend_chf: number;
  conversions: number;
  ctr: number | null;
  cpc_chf: number | null;
}

// Metriken fuer eine Kampagne laden
export async function getMetricsByCampaign(
  campaignId: string,
  client?: SupabaseClient
): Promise<CampaignMetric[]> {
  const db = client ?? await getServerClient();
  const { data, error } = await db
    .from("campaign_metrics")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("date", { ascending: false });

  if (error) throw new Error(`Metriken laden fehlgeschlagen: ${error.message}`);
  return data as CampaignMetric[];
}

// Metrik einfuegen oder aktualisieren (Upsert)
export async function upsertMetric(
  metric: Omit<CampaignMetric, "id">,
  client?: SupabaseClient
): Promise<CampaignMetric> {
  const db = client ?? await getServerClient();

  // CTR und CPC berechnen
  const ctr = metric.impressions > 0 ? metric.clicks / metric.impressions : null;
  const cpc = metric.clicks > 0 ? metric.spend_chf / metric.clicks : null;

  const { data, error } = await db
    .from("campaign_metrics")
    .upsert({
      ...metric,
      ctr,
      cpc_chf: cpc,
    }, {
      onConflict: "campaign_id,platform,date",
    })
    .select()
    .single();

  if (error) throw new Error(`Metrik speichern fehlgeschlagen: ${error.message}`);
  return data as CampaignMetric;
}

// Metriken pro Plattform aggregieren
export async function getAggregatedMetrics(
  campaignId: string,
  client?: SupabaseClient
): Promise<Record<string, { impressions: number; clicks: number; spend: number; conversions: number; ctr: number }>> {
  const metrics = await getMetricsByCampaign(campaignId, client);
  const result: Record<string, { impressions: number; clicks: number; spend: number; conversions: number; ctr: number }> = {};

  for (const m of metrics) {
    if (!result[m.platform]) {
      result[m.platform] = { impressions: 0, clicks: 0, spend: 0, conversions: 0, ctr: 0 };
    }
    const agg = result[m.platform];
    agg.impressions += Number(m.impressions);
    agg.clicks += Number(m.clicks);
    agg.spend += Number(m.spend_chf);
    agg.conversions += Number(m.conversions);
  }

  // CTR berechnen
  for (const key of Object.keys(result)) {
    const agg = result[key];
    agg.ctr = agg.impressions > 0 ? agg.clicks / agg.impressions : 0;
  }

  return result;
}
