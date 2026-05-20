import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildCanvaOAuthConfig, exchangeCode, saveToken } from "@/lib/integrations/canva-oauth";

// GET /api/integrations/canva/callback — Canva OAuth2 PKCE Callback
export async function GET(request: NextRequest) {
  const config = buildCanvaOAuthConfig();
  if (!config) {
    return NextResponse.json({ error: "Canva nicht konfiguriert" }, { status: 400 });
  }

  const code = request.nextUrl.searchParams.get("code");
  const stateStr = request.nextUrl.searchParams.get("state");
  const errorParam = request.nextUrl.searchParams.get("error");

  // Canva kann Error-Parameter senden bei Ablehnung
  if (errorParam) {
    const appUrl = process.env.NEXTJS_APP_URL ?? "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/settings/canva?canva=error&reason=${errorParam}`);
  }

  if (!code) {
    return NextResponse.json({ error: "Authorization Code fehlt" }, { status: 400 });
  }

  // PKCE: Code Verifier aus Cookie lesen
  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get("canva_code_verifier")?.value;
  const savedState = cookieStore.get("canva_oauth_state")?.value;

  if (!codeVerifier) {
    return NextResponse.json({ error: "PKCE Code Verifier fehlt — bitte erneut verbinden" }, { status: 400 });
  }

  // State validieren (CSRF-Schutz)
  let brand = "default";
  if (stateStr) {
    try {
      const parsed = JSON.parse(stateStr);
      brand = parsed.brand ?? "default";
      // Nonce pruefen
      if (savedState && parsed.nonce !== savedState) {
        return NextResponse.json({ error: "State-Validierung fehlgeschlagen" }, { status: 400 });
      }
    } catch {
      // State ungueltig, default nutzen
    }
  }

  try {
    // Token-Exchange mit PKCE code_verifier
    const token = await exchangeCode(config, code, codeVerifier);
    await saveToken(brand, token);

    // Cookies aufraeuemen
    cookieStore.delete("canva_code_verifier");
    cookieStore.delete("canva_oauth_state");

    // Zurueck zur Canva Settings Page
    const appUrl = process.env.NEXTJS_APP_URL ?? "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/settings/canva?canva=connected`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    const appUrl = process.env.NEXTJS_APP_URL ?? "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/settings/canva?canva=error&reason=${encodeURIComponent(message)}`);
  }
}
