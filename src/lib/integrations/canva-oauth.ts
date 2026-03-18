// Canva OAuth2 mit PKCE — Token-Management pro Brand

import { getServerClient } from "@/lib/db/supabase";
import type { CanvaOAuthToken } from "@/types/database";

const CANVA_AUTH_URL = "https://www.canva.com/api/oauth/authorize";
const CANVA_TOKEN_URL = "https://www.canva.com/api/oauth/token";

export interface CanvaOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function buildCanvaOAuthConfig(): CanvaOAuthConfig | null {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const redirectUri = process.env.CANVA_REDIRECT_URI ?? `${process.env.NEXTJS_APP_URL}/api/integrations/canva/callback`;

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

// Authorization URL generieren
export function getAuthorizationUrl(config: CanvaOAuthConfig, brand: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "design:content:read design:content:write asset:read asset:write brand_template:content:read brand_template:meta:read",
    state: JSON.stringify({ brand, state }),
  });
  return `${CANVA_AUTH_URL}?${params.toString()}`;
}

// Authorization Code → Access Token tauschen
export async function exchangeCode(config: CanvaOAuthConfig, code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scopes: string[];
}> {
  const response = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Canva Token-Exchange fehlgeschlagen: ${error}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scopes: (data.scope ?? "").split(" "),
  };
}

// Access Token erneuern
export async function refreshAccessToken(config: CanvaOAuthConfig, refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const response = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error("Canva Token-Refresh fehlgeschlagen");
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresIn: data.expires_in,
  };
}

// Token fuer Brand speichern/aktualisieren
export async function saveToken(brand: string, token: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scopes?: string[];
}): Promise<void> {
  const db = await getServerClient();
  const expiresAt = new Date(Date.now() + token.expiresIn * 1000).toISOString();

  const { error } = await db
    .from("canva_oauth_tokens")
    .upsert({
      brand,
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      expires_at: expiresAt,
      scopes: token.scopes ?? [],
      updated_at: new Date().toISOString(),
    }, { onConflict: "brand" });

  if (error) throw new Error(`Token speichern fehlgeschlagen: ${error.message}`);
}

// Gueltigen Token fuer Brand abrufen (auto-refresh wenn abgelaufen)
export async function getValidToken(brand: string): Promise<string | null> {
  const db = await getServerClient();
  const { data } = await db
    .from("canva_oauth_tokens")
    .select("*")
    .eq("brand", brand)
    .single();

  if (!data) return null;

  const token = data as CanvaOAuthToken;
  const expiresAt = new Date(token.expires_at);

  // Token noch gueltig (mit 5 Min Puffer)
  if (expiresAt.getTime() - 300000 > Date.now()) {
    return token.access_token;
  }

  // Token erneuern
  const config = buildCanvaOAuthConfig();
  if (!config) return null;

  try {
    const refreshed = await refreshAccessToken(config, token.refresh_token);
    await saveToken(brand, refreshed);
    return refreshed.accessToken;
  } catch {
    console.error(`Canva Token-Refresh fuer ${brand} fehlgeschlagen`);
    return null;
  }
}
