import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { buildCanvaOAuthConfig, getValidToken } from "@/lib/integrations/canva-oauth";

// GET /api/integrations/canva/status — Canva-Verbindungsstatus
// Verbindungs-Initiierung laeuft ueber /api/integrations/canva/authorize
// (HTTPOnly-Cookie-Setup mit PKCE).
export async function GET() {
  const config = buildCanvaOAuthConfig();
  const configured = config !== null;

  const brand = "default";
  let connected = false;
  let authenticated = false;

  const user = await getAuthUser().catch(() => null);
  if (user) {
    authenticated = true;
    if (configured) {
      try {
        const token = await getValidToken(brand);
        connected = token !== null;
      } catch {
        connected = false;
      }
    }
  }

  return NextResponse.json({
    configured,
    connected,
    authenticated,
    brand,
  });
}
