import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/db/supabase";
import { uploadFromUrl } from "@/lib/integrations/storage";
import { getAuthUser } from "@/lib/auth/get-user";
import type { Asset } from "@/types/database";

// GET /api/assets/[id]/poll — Video-Status pruefen
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { id: assetId } = await params;
    const db = await getServerClient();

    const { data, error } = await db
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Asset nicht gefunden" }, { status: 404 });
    }

    const asset = data as Asset;

    // Nur processing-Assets muessen gepollt werden
    if (asset.status !== "processing") {
      return NextResponse.json({
        status: asset.status,
        storage_url: asset.storage_url ?? asset.storage_path,
      });
    }

    // Poll-URL steht im error_message Feld (Workaround aus content/route.ts)
    const pollUrl = asset.error_message;
    if (!pollUrl || !pollUrl.startsWith("http")) {
      return NextResponse.json({ status: "processing", message: "Keine Poll-URL verfuegbar" });
    }

    // Video-Provider pollen
    try {
      const response = await fetch(pollUrl);
      if (!response.ok) {
        return NextResponse.json({ status: "processing" });
      }

      const result = await response.json();

      if (result.status === "completed" && result.videoUrl) {
        // Video in Storage persistieren
        const uploadResult = await uploadFromUrl(
          asset.campaign_id, asset.channel, asset.format, asset.language,
          result.videoUrl, "mp4"
        );

        // Asset aktualisieren
        await db
          .from("assets")
          .update({
            status: "completed",
            storage_path: uploadResult.publicUrl,
            storage_url: uploadResult.publicUrl,
            file_size_bytes: uploadResult.fileSize,
            mime_type: uploadResult.mimeType,
            error_message: null,
          })
          .eq("id", assetId);

        return NextResponse.json({
          status: "completed",
          storage_url: uploadResult.publicUrl,
        });
      }

      if (result.status === "failed") {
        await db
          .from("assets")
          .update({
            status: "failed",
            error_message: result.error ?? "Video-Generierung fehlgeschlagen",
          })
          .eq("id", assetId);

        return NextResponse.json({ status: "failed", error: result.error });
      }

      return NextResponse.json({ status: "processing" });
    } catch {
      return NextResponse.json({ status: "processing" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
