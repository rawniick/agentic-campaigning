import { NextRequest, NextResponse } from "next/server";
import { buildCanvaOAuthConfig, getAuthorizationUrl } from "@/lib/integrations/canva-oauth";
import { getAuthUser } from "@/lib/auth/get-user";
import { randomUUID } from "crypto";

// GET /api/integrations/canva/authorize — Canva OAuth2 starten
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

  const config = buildCanvaOAuthConfig();
  if (!config) {
    return NextResponse.json({ error: "Canva nicht konfiguriert" }, { status: 400 });
  }

  const brand = request.nextUrl.searchParams.get("brand") ?? "default";
  const state = randomUUID();

  const url = getAuthorizationUrl(config, brand, state);
  return NextResponse.redirect(url);
}
