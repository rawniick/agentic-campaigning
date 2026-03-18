// Meta + Google Ads Metriken abrufen
// Nutzt bestehende API-Clients fuer Performance-Daten

import { upsertMetric } from "@/lib/db/queries/metrics";

export interface MetricsFetchResult {
  platform: string;
  metricsCount: number;
  error?: string;
}

// Meta Insights abrufen (Mock-bereit)
export async function fetchMetaMetrics(
  campaignId: string,
  platformCampaignId: string,
  dateFrom: string,
  dateTo: string
): Promise<MetricsFetchResult> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    console.log("[Mock] Meta Metriken fetch fuer:", platformCampaignId);
    return { platform: "meta", metricsCount: 0 };
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${platformCampaignId}/insights?fields=impressions,clicks,spend,actions&time_range={"since":"${dateFrom}","until":"${dateTo}"}&time_increment=1`;

    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Meta API Fehler: HTTP ${response.status}`);
    }

    const data = await response.json();
    let count = 0;

    for (const row of data.data ?? []) {
      const conversions = (row.actions ?? [])
        .filter((a: { action_type: string }) => a.action_type === "offsite_conversion")
        .reduce((sum: number, a: { value: string }) => sum + parseInt(a.value ?? "0"), 0);

      await upsertMetric({
        campaign_id: campaignId,
        platform: "meta",
        date: row.date_start,
        impressions: parseInt(row.impressions ?? "0"),
        clicks: parseInt(row.clicks ?? "0"),
        spend_chf: parseFloat(row.spend ?? "0"),
        conversions,
        ctr: null,
        cpc_chf: null,
      });
      count++;
    }

    return { platform: "meta", metricsCount: count };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return { platform: "meta", metricsCount: 0, error: message };
  }
}

// Google Ads Metriken abrufen (Mock-bereit)
export async function fetchGoogleAdsMetrics(
  campaignId: string,
  platformCampaignId: string,
  dateFrom: string,
  dateTo: string
): Promise<MetricsFetchResult> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    console.log("[Mock] Google Ads Metriken fetch fuer:", platformCampaignId);
    return { platform: "google_ads", metricsCount: 0 };
  }

  try {
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
    const url = `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`;

    const query = `
      SELECT
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM campaign
      WHERE campaign.id = '${platformCampaignId}'
        AND segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
    `;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GOOGLE_ADS_REFRESH_TOKEN}`,
        "developer-token": developerToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Google Ads API Fehler: HTTP ${response.status}`);
    }

    const data = await response.json();
    let count = 0;

    for (const batch of data) {
      for (const result of batch.results ?? []) {
        await upsertMetric({
          campaign_id: campaignId,
          platform: "google_ads",
          date: result.segments?.date ?? dateFrom,
          impressions: parseInt(result.metrics?.impressions ?? "0"),
          clicks: parseInt(result.metrics?.clicks ?? "0"),
          spend_chf: parseInt(result.metrics?.cost_micros ?? "0") / 1000000,
          conversions: parseInt(result.metrics?.conversions ?? "0"),
          ctr: null,
          cpc_chf: null,
        });
        count++;
      }
    }

    return { platform: "google_ads", metricsCount: count };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return { platform: "google_ads", metricsCount: 0, error: message };
  }
}

// Alle Plattformen syncen
export async function syncAllMetrics(
  campaignId: string,
  distributions: Array<{ platform: string; platform_campaign_id: string | null }>,
  dateFrom: string,
  dateTo: string
): Promise<MetricsFetchResult[]> {
  const results: MetricsFetchResult[] = [];

  for (const dist of distributions) {
    if (!dist.platform_campaign_id) continue;

    if (dist.platform === "meta") {
      results.push(await fetchMetaMetrics(campaignId, dist.platform_campaign_id, dateFrom, dateTo));
    } else if (dist.platform === "google_ads") {
      results.push(await fetchGoogleAdsMetrics(campaignId, dist.platform_campaign_id, dateFrom, dateTo));
    }
  }

  return results;
}
