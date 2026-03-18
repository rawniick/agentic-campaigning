// Meta Marketing API Integration (Mock-Modus wenn Env-Vars fehlen)

export interface MetaAdsConfig {
  accessToken: string;
  adAccountId: string;
}

export type MetaAdsErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

export class MetaAdsError extends Error {
  constructor(
    public readonly code: MetaAdsErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "MetaAdsError";
  }
}

interface MetaAdCreative {
  id: string;
  name: string;
  status: string;
}

interface MetaAd {
  id: string;
  name: string;
  status: string;
  creativeId: string;
}

interface MetaAdStatus {
  id: string;
  effective_status: string;
  delivery_status: string;
}

const META_API_BASE = "https://graph.facebook.com/v21.0";

/**
 * Meta-Konfiguration aus Env-Vars erstellen.
 * Gibt null zurueck wenn nicht konfiguriert (= Mock-Modus).
 */
export function buildMetaConfig(): MetaAdsConfig | null {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    return null;
  }

  return { accessToken, adAccountId };
}

/**
 * Bild an Meta hochladen.
 * Mock: gibt Placeholder-Hash zurueck.
 */
export async function uploadImage(
  config: MetaAdsConfig | null,
  imageUrl: string,
  name: string
): Promise<{ hash: string }> {
  if (!config) {
    // Mock-Modus
    return { hash: `mock_hash_${Date.now()}` };
  }

  const response = await fetch(
    `${META_API_BASE}/act_${config.adAccountId}/adimages`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: imageUrl, name }),
    }
  );

  if (!response.ok) {
    throw mapMetaError(await response.json());
  }

  const data = await response.json();
  const images = data.images as Record<string, { hash: string }>;
  const firstImage = Object.values(images)[0];
  if (!firstImage) throw new MetaAdsError("UNKNOWN", "Kein Bild-Hash in Response");
  return { hash: firstImage.hash };
}

/**
 * Ad Creative erstellen.
 * Mock: gibt Placeholder-Creative zurueck.
 */
export async function createAdCreative(
  config: MetaAdsConfig | null,
  params: {
    name: string;
    imageHash?: string;
    message: string;
    link?: string;
    callToAction?: string;
  }
): Promise<MetaAdCreative> {
  if (!config) {
    return {
      id: `mock_creative_${Date.now()}`,
      name: params.name,
      status: "ACTIVE",
    };
  }

  const body: Record<string, unknown> = {
    name: params.name,
    object_story_spec: {
      link_data: {
        message: params.message,
        link: params.link ?? "https://www.coopmobile.ch",
        image_hash: params.imageHash,
        call_to_action: params.callToAction
          ? { type: params.callToAction }
          : undefined,
      },
    },
  };

  const response = await fetch(
    `${META_API_BASE}/act_${config.adAccountId}/adcreatives`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw mapMetaError(await response.json());
  }

  const data = await response.json();
  return {
    id: data.id,
    name: params.name,
    status: "ACTIVE",
  };
}

/**
 * Ad erstellen und starten.
 * Mock: gibt Placeholder-Ad zurueck.
 */
export async function createAd(
  config: MetaAdsConfig | null,
  params: {
    name: string;
    adsetId: string;
    creativeId: string;
    status?: string;
  }
): Promise<MetaAd> {
  if (!config) {
    return {
      id: `mock_ad_${Date.now()}`,
      name: params.name,
      status: params.status ?? "PAUSED",
      creativeId: params.creativeId,
    };
  }

  const response = await fetch(
    `${META_API_BASE}/act_${config.adAccountId}/ads`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: params.name,
        adset_id: params.adsetId,
        creative: { creative_id: params.creativeId },
        status: params.status ?? "PAUSED",
      }),
    }
  );

  if (!response.ok) {
    throw mapMetaError(await response.json());
  }

  const data = await response.json();
  return {
    id: data.id,
    name: params.name,
    status: params.status ?? "PAUSED",
    creativeId: params.creativeId,
  };
}

/**
 * Ad-Status abfragen.
 * Mock: gibt Placeholder-Status zurueck.
 */
export async function getAdStatus(
  config: MetaAdsConfig | null,
  adId: string
): Promise<MetaAdStatus> {
  if (!config) {
    return {
      id: adId,
      effective_status: "ACTIVE",
      delivery_status: "active",
    };
  }

  const response = await fetch(
    `${META_API_BASE}/${adId}?fields=effective_status,delivery_info`,
    {
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw mapMetaError(await response.json());
  }

  const data = await response.json();
  return {
    id: data.id,
    effective_status: data.effective_status,
    delivery_status: data.delivery_info?.status ?? "unknown",
  };
}

// Meta API Fehler auf typed MetaAdsError mappen
function mapMetaError(data: unknown): MetaAdsError {
  const err = (data as { error?: { message?: string; code?: number; type?: string } })?.error;
  const message = err?.message ?? "Unbekannter Meta-API-Fehler";
  const code = err?.code;

  if (code === 190 || code === 102) {
    return new MetaAdsError("UNAUTHENTICATED", `Meta Auth-Fehler: ${message}`, data);
  }
  if (code === 100) {
    return new MetaAdsError("VALIDATION_ERROR", `Meta Validierung: ${message}`, data);
  }
  if (code === 4 || code === 17 || code === 32) {
    return new MetaAdsError("RATE_LIMITED", `Meta Rate Limit: ${message}`, data);
  }
  return new MetaAdsError("UNKNOWN", `Meta-Fehler: ${message}`, data);
}

// Video-Upload fuer Reels/Stories
export async function uploadVideo(
  config: MetaAdsConfig | null,
  videoUrl: string,
  title: string
): Promise<string> {
  if (!config) {
    console.log("[Mock] Meta Video Upload:", title);
    return `mock_video_${Date.now()}`;
  }

  // Meta Video Upload API (resumable)
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${config.adAccountId}/advideos`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_url: videoUrl,
        title,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Meta Video Upload fehlgeschlagen: HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.id;
}
