// Google Ads API Integration (Mock-Modus wenn Env-Vars fehlen)

import { OAuth2Client } from "google-auth-library";

export interface GoogleAdsConfig {
  developerToken: string;
  oauth2Client: OAuth2Client;
  customerId: string;
}

export type GoogleAdsErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

export class GoogleAdsError extends Error {
  constructor(
    public readonly code: GoogleAdsErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "GoogleAdsError";
  }
}

interface GoogleAdsResponsiveSearchAd {
  id: string;
  resourceName: string;
  status: string;
}

interface GoogleAdsResponsiveDisplayAd {
  id: string;
  resourceName: string;
  status: string;
}

interface GoogleAdsImageAsset {
  id: string;
  resourceName: string;
}

interface GoogleAdsStatus {
  id: string;
  status: string;
  policyStatus: string;
}

const GOOGLE_ADS_API_BASE = "https://googleads.googleapis.com/v18";

/**
 * Google Ads Konfiguration aus Env-Vars erstellen.
 * Gibt null zurueck wenn nicht konfiguriert (= Mock-Modus).
 */
export function buildGoogleAdsConfig(): GoogleAdsConfig | null {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;

  if (!developerToken || !clientId || !clientSecret || !refreshToken || !customerId) {
    return null;
  }

  const oauth2Client = new OAuth2Client(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return { developerToken, oauth2Client, customerId };
}

// Authorization-Header fuer Google Ads API holen
async function getAuthHeaders(config: GoogleAdsConfig): Promise<Record<string, string>> {
  const { token } = await config.oauth2Client.getAccessToken();
  if (!token) throw new GoogleAdsError("UNAUTHENTICATED", "Kein Access Token erhalten");

  return {
    "Authorization": `Bearer ${token}`,
    "developer-token": config.developerToken,
    "Content-Type": "application/json",
  };
}

/**
 * Responsive Search Ad erstellen (SEA).
 * Mock: gibt Placeholder zurueck.
 */
export async function createResponsiveSearchAd(
  config: GoogleAdsConfig | null,
  params: {
    campaignResourceName: string;
    adGroupResourceName: string;
    headlines: string[];
    descriptions: string[];
    finalUrl: string;
  }
): Promise<GoogleAdsResponsiveSearchAd> {
  if (!config) {
    return {
      id: `mock_rsa_${Date.now()}`,
      resourceName: `customers/mock/ads/mock_rsa_${Date.now()}`,
      status: "PAUSED",
    };
  }

  const headers = await getAuthHeaders(config);
  const operations = [{
    create: {
      ad_group: params.adGroupResourceName,
      ad: {
        responsive_search_ad: {
          headlines: params.headlines.map((text, i) => ({
            text,
            pinned_field: i < 3 ? `HEADLINE_${i + 1}` : undefined,
          })),
          descriptions: params.descriptions.map((text) => ({ text })),
        },
        final_urls: [params.finalUrl],
      },
      status: "PAUSED",
    },
  }];

  const response = await fetch(
    `${GOOGLE_ADS_API_BASE}/customers/${config.customerId}/adGroupAds:mutate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ operations }),
    }
  );

  if (!response.ok) {
    throw await mapGoogleAdsError(response);
  }

  const data = await response.json();
  const result = data.results?.[0];
  return {
    id: result?.resourceName?.split("/").pop() ?? "unknown",
    resourceName: result?.resourceName ?? "unknown",
    status: "PAUSED",
  };
}

/**
 * Responsive Display Ad erstellen.
 * Mock: gibt Placeholder zurueck.
 */
export async function createResponsiveDisplayAd(
  config: GoogleAdsConfig | null,
  params: {
    adGroupResourceName: string;
    headlines: string[];
    descriptions: string[];
    longHeadline: string;
    businessName: string;
    imageAssetResourceName?: string;
    finalUrl: string;
  }
): Promise<GoogleAdsResponsiveDisplayAd> {
  if (!config) {
    return {
      id: `mock_rda_${Date.now()}`,
      resourceName: `customers/mock/ads/mock_rda_${Date.now()}`,
      status: "PAUSED",
    };
  }

  const headers = await getAuthHeaders(config);
  const operations = [{
    create: {
      ad_group: params.adGroupResourceName,
      ad: {
        responsive_display_ad: {
          headlines: params.headlines.map((text) => ({ text })),
          descriptions: params.descriptions.map((text) => ({ text })),
          long_headline: { text: params.longHeadline },
          business_name: params.businessName,
          marketing_images: params.imageAssetResourceName
            ? [{ asset: params.imageAssetResourceName }]
            : [],
        },
        final_urls: [params.finalUrl],
      },
      status: "PAUSED",
    },
  }];

  const response = await fetch(
    `${GOOGLE_ADS_API_BASE}/customers/${config.customerId}/adGroupAds:mutate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ operations }),
    }
  );

  if (!response.ok) {
    throw await mapGoogleAdsError(response);
  }

  const data = await response.json();
  const result = data.results?.[0];
  return {
    id: result?.resourceName?.split("/").pop() ?? "unknown",
    resourceName: result?.resourceName ?? "unknown",
    status: "PAUSED",
  };
}

/**
 * Bild als Asset hochladen.
 * Mock: gibt Placeholder zurueck.
 */
export async function uploadImageAsset(
  config: GoogleAdsConfig | null,
  params: { name: string; imageUrl: string }
): Promise<GoogleAdsImageAsset> {
  if (!config) {
    return {
      id: `mock_img_${Date.now()}`,
      resourceName: `customers/mock/assets/mock_img_${Date.now()}`,
    };
  }

  // Bild herunterladen und als base64 konvertieren
  const imageResponse = await fetch(params.imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const imageData = Buffer.from(imageBuffer).toString("base64");

  const headers = await getAuthHeaders(config);
  const operations = [{
    create: {
      name: params.name,
      type: "IMAGE",
      image_asset: { data: imageData },
    },
  }];

  const response = await fetch(
    `${GOOGLE_ADS_API_BASE}/customers/${config.customerId}/assets:mutate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ operations }),
    }
  );

  if (!response.ok) {
    throw await mapGoogleAdsError(response);
  }

  const data = await response.json();
  const result = data.results?.[0];
  return {
    id: result?.resourceName?.split("/").pop() ?? "unknown",
    resourceName: result?.resourceName ?? "unknown",
  };
}

/**
 * Ad-Status abfragen.
 * Mock: gibt Placeholder zurueck.
 */
export async function getAdStatus(
  config: GoogleAdsConfig | null,
  adResourceName: string
): Promise<GoogleAdsStatus> {
  if (!config) {
    return {
      id: adResourceName,
      status: "ENABLED",
      policyStatus: "APPROVED",
    };
  }

  const headers = await getAuthHeaders(config);
  const response = await fetch(
    `${GOOGLE_ADS_API_BASE}/customers/${config.customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `SELECT ad_group_ad.ad.id, ad_group_ad.status, ad_group_ad.policy_summary.approval_status FROM ad_group_ad WHERE ad_group_ad.resource_name = '${adResourceName.replace(/'/g, "")}'`,
      }),
    }
  );

  if (!response.ok) {
    throw await mapGoogleAdsError(response);
  }

  const data = await response.json();
  const row = data[0]?.results?.[0]?.adGroupAd;
  return {
    id: row?.ad?.id ?? "unknown",
    status: row?.status ?? "UNKNOWN",
    policyStatus: row?.policySummary?.approvalStatus ?? "UNKNOWN",
  };
}

// Google Ads Fehler mappen
async function mapGoogleAdsError(response: Response): Promise<GoogleAdsError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const status = response.status;
  const message = (body as { error?: { message?: string } })?.error?.message
    ?? `Google Ads API Fehler (HTTP ${status})`;

  if (status === 401 || status === 403) {
    return new GoogleAdsError("UNAUTHENTICATED", `Google Ads Auth-Fehler: ${message}`, body);
  }
  if (status === 404) {
    return new GoogleAdsError("NOT_FOUND", `Google Ads nicht gefunden: ${message}`, body);
  }
  if (status === 429) {
    return new GoogleAdsError("RATE_LIMITED", `Google Ads Rate Limit: ${message}`, body);
  }
  if (status === 400) {
    return new GoogleAdsError("VALIDATION_ERROR", `Google Ads Validierung: ${message}`, body);
  }
  return new GoogleAdsError("UNKNOWN", `Google Ads Fehler: ${message}`, body);
}
