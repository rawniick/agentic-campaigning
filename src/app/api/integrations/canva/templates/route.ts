import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { listBrandTemplates } from "@/lib/integrations/canva-api";

// GET /api/integrations/canva/templates — Canva Brand Templates auflisten
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

  const brand = request.nextUrl.searchParams.get("brand") ?? "default";

  try {
    const templates = await listBrandTemplates(brand);
    return NextResponse.json({ templates, brand });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Canva Templates konnten nicht geladen werden";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
