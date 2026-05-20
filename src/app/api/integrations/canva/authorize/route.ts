import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildCanvaOAuthConfig,
  getAuthorizationUrl,
  generateCodeVerifier,
  generateCodeChallenge,
} from "@/lib/integrations/canva-oauth";
import { getAuthUser } from "@/lib/auth/get-user";
import { randomUUID } from "crypto";

// GET /api/integrations/canva/authorize — Canva OAuth2 + PKCE starten
export async function GET(request: NextRequest) {
  const config = buildCanvaOAuthConfig();
  if (!config) {
    return NextResponse.json({ error: "Canva nicht konfiguriert" }, { status: 400 });
  }

  const brand = request.nextUrl.searchParams.get("brand") ?? "default";
  const state = randomUUID();

  // PKCE: Code Verifier + Challenge generieren
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Code Verifier + State in Cookie speichern (httpOnly, SameSite=Lax fuer Redirect)
  const cookieStore = await cookies();
  cookieStore.set("canva_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 Minuten
    path: "/",
  });
  cookieStore.set("canva_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const url = getAuthorizationUrl(config, brand, state, codeChallenge);
  return NextResponse.redirect(url);
}
