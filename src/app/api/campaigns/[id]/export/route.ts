import { z } from "zod";
import { getDb } from "@/lib/db/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { exportCampaignZip, EmptyExportError } from "@/lib/export/exportCampaignZip";
import { fetchAssetBytesFromUrl } from "@/lib/export/fetchAssetBytes";

// archiver (in exportCampaignZip) ist Node-only — kein Edge-Runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validate-at-the-boundary wie die Server-Actions (finalRenderSchema etc.):
// nur eine UUID erreicht Query + Response-Header.
const idSchema = z.string().uuid();

// GET /api/campaigns/[id]/export
// Zippt alle gerenderten Assets der Kampagne frisch bei jedem Klick (nie stale)
// und liefert sie als Download. Asset-Bytes werden parallel gefetcht.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Ungueltige Kampagnen-ID" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const campaignId = parsed.data;

  // Single-User-Lockdown: API-Routen pruefen Auth explizit (sauberer 401 statt
  // HTML-Redirect; Defense-in-depth zusaetzlich zum Middleware-Redirect).
  const user = await getAuthUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const zip = await exportCampaignZip(
      getDb(),
      campaignId,
      fetchAssetBytesFromUrl
    );
    return new Response(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="wingo_kampagne_${campaignId}.zip"`,
        "Content-Length": String(zip.length),
      },
    });
  } catch (e) {
    // Leerer Export ist ein erwarteter Zustand (z.B. Platzhalter-Logo blockt alle
    // Assets) — klare 422-Meldung statt generischem 500. Die Message ist
    // bewusst nutzerfreundlich und enthaelt keine internen Details.
    if (e instanceof EmptyExportError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Interne Fehlerdetails (DB-/Storage-URLs, Treiber-Internals) nur
    // serverseitig loggen — nicht an den Client zurueckgeben.
    console.error(
      `[export] ZIP-Export fehlgeschlagen fuer Kampagne ${campaignId}:`,
      e
    );
    return new Response(
      JSON.stringify({ error: "ZIP-Export fehlgeschlagen" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
