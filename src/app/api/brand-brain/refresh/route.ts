import { NextRequest, NextResponse } from "next/server";
import { invalidateCache } from "@/lib/ai/brand-brain/drive-cache";
import { resetAllSources } from "@/lib/ai/brand-brain/loader";

// POST /api/brand-brain/refresh
// Invalidiert den Cache im Supabase Storage und setzt Frontify + Drive Kontext zurueck.
// Kann von n8n, Frontify Webhook oder manuell getriggert werden.
export async function POST(request: NextRequest) {
  // Bearer-Token Auth
  const secret = process.env.BRAND_BRAIN_REFRESH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "BRAND_BRAIN_REFRESH_SECRET nicht konfiguriert" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");

  if (!token || token !== secret) {
    return NextResponse.json(
      { error: "Nicht autorisiert" },
      { status: 401 }
    );
  }

  // Body parsen (optional)
  let fileKey: string | undefined;
  let source: string | undefined;
  try {
    const body = (await request.json()) as {
      fileKey?: string;
      source?: "frontify" | "drive" | "all";
    };
    fileKey = body.fileKey;
    source = body.source;
  } catch {
    // Leerer Body = alle invalidieren
  }

  try {
    // Cache invalidieren
    if (source === "frontify") {
      // Nur Frontify-Cache invalidieren
      const frontifyKeys = [
        "frontify:tone-of-voice",
        "frontify:ci-rules",
        "frontify:glossar-de",
        "frontify:glossar-fr",
        "frontify:glossar-it",
        "frontify:glossar-en",
      ];
      if (fileKey) {
        await invalidateCache(`frontify:${fileKey}`);
      } else {
        await Promise.all(frontifyKeys.map((key) => invalidateCache(key)));
      }
    } else if (source === "drive") {
      // Nur Drive-Cache invalidieren
      await invalidateCache(fileKey);
    } else {
      // Alles invalidieren
      await invalidateCache(fileKey);
    }

    // Alle Kontexte zuruecksetzen (Drive + Frontify)
    resetAllSources();

    return NextResponse.json({
      success: true,
      invalidated: fileKey ?? "all",
      source: source ?? "all",
    });
  } catch (err) {
    console.error("[Brand Brain Refresh] Fehler:", err);
    return NextResponse.json(
      { error: "Cache-Invalidierung fehlgeschlagen", details: String(err) },
      { status: 500 }
    );
  }
}
