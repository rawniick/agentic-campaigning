import { NextRequest, NextResponse } from "next/server";
import archiver from "archiver";
import { Readable } from "stream";
import { getCampaignById } from "@/lib/db/queries/campaigns";
import { getAssetsByCampaign } from "@/lib/db/queries/assets";
import { getSelectedConcept } from "@/lib/db/queries/concepts";
import { getAuthUser } from "@/lib/auth/get-user";
import type { Asset } from "@/types/database";

// GET /api/export/download?campaignId=xxx — ZIP mit allen Campaign Assets
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const campaignId = request.nextUrl.searchParams.get("campaignId");
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId ist Pflicht" }, { status: 400 });
    }

    const campaign = await getCampaignById(campaignId);
    const assets = await getAssetsByCampaign(campaignId);
    const concept = await getSelectedConcept(campaignId);

    const completedAssets = assets.filter((a: Asset) => a.status === "completed");
    if (completedAssets.length === 0) {
      return NextResponse.json({ error: "Keine fertigen Assets vorhanden" }, { status: 400 });
    }

    // ZIP als Stream
    const archive = archiver("zip", { zlib: { level: 6 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));

    // Briefing JSON hinzufuegen
    const briefing = {
      campaign_id: campaignId,
      promo_id: campaign.promo_id,
      brand: campaign.brand,
      product: campaign.product_name,
      leitidee: concept?.leitidee,
      claims: concept?.claims,
      hero_message: concept?.hero_message,
      generated_at: new Date().toISOString(),
    };
    archive.append(JSON.stringify(briefing, null, 2), { name: "briefing.json" });

    // Assets herunterladen und hinzufuegen
    for (const asset of completedAssets) {
      const url = asset.storage_url ?? asset.storage_path;
      if (!url || url.startsWith("data:")) continue;

      try {
        const response = await fetch(url);
        if (!response.ok) continue;

        const buffer = Buffer.from(await response.arrayBuffer());
        const ext = asset.mime_type?.split("/")[1] ?? "png";
        const filename = `${asset.channel}/${asset.format}_${asset.language}.${ext}`;
        archive.append(buffer, { name: filename });
      } catch {
        // Asset ueberspringen wenn Download fehlschlaegt
      }
    }

    await archive.finalize();
    const zipBuffer = Buffer.concat(chunks);

    const safeName = campaign.promo_id.replace(/[^a-zA-Z0-9-_]/g, "_");
    return new Response(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="kampagne-${safeName}.zip"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
