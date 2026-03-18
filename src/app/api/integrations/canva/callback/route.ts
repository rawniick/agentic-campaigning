import { NextRequest, NextResponse } from "next/server";
import { buildCanvaOAuthConfig, exchangeCode, saveToken } from "@/lib/integrations/canva-oauth";

// GET /api/integrations/canva/callback — Canva OAuth2 Callback
export async function GET(request: NextRequest) {
  const config = buildCanvaOAuthConfig();
  if (!config) {
    return NextResponse.json({ error: "Canva nicht konfiguriert" }, { status: 400 });
  }

  const code = request.nextUrl.searchParams.get("code");
  const stateStr = request.nextUrl.searchParams.get("state");

  if (!code) {
    return NextResponse.json({ error: "Authorization Code fehlt" }, { status: 400 });
  }

  let brand = "default";
  if (stateStr) {
    try {
      const parsed = JSON.parse(stateStr);
      brand = parsed.brand ?? "default";
    } catch {
      // State ungueltig, default nutzen
    }
  }

  try {
    const token = await exchangeCode(config, code);
    await saveToken(brand, token);

    // Zurueck zum Dashboard
    const appUrl = process.env.NEXTJS_APP_URL ?? "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/campaigns?canva=connected`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
