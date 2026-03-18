import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/db/supabase";
import { getCampaignById } from "@/lib/db/queries/campaigns";
import { logAuditEvent } from "@/lib/db/queries/approvals";
import { getAuthUser } from "@/lib/auth/get-user";

// POST /api/campaigns/[id]/clone — Kampagne klonen (ohne generierte Inhalte)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { id: sourceId } = await params;
    const source = await getCampaignById(sourceId);

    const db = await getServerClient();

    // Neue Kampagne aus Quelle erstellen (ohne generierte Inhalte)
    const { data: cloned, error } = await db
      .from("campaigns")
      .insert({
        promo_id: `${source.promo_id}-CLONE-${Date.now().toString(36).toUpperCase()}`,
        brand: source.brand,
        campaign_type: source.campaign_type,
        status: "draft",
        created_by: user.id,
        flow_version: source.flow_version,

        // Produkt
        product_name: source.product_name,
        product_type: source.product_type,
        product_sku: source.product_sku,
        product_features: source.product_features,
        product_network: source.product_network,

        // Pricing
        price_old: source.price_old,
        price_new: source.price_new,
        currency: source.currency,
        price_suffix: source.price_suffix,
        discount_type: source.discount_type,
        discount_value: source.discount_value,
        discount_display: source.discount_display,
        discount_duration: source.discount_duration,
        price_conditions: source.price_conditions,

        // Kampagne
        target_audiences: source.target_audiences,
        business_goal: source.business_goal,
        kpi_targets: source.kpi_targets,

        // Kanaele
        channels: source.channels,
        languages: source.languages,

        // Compliance
        disclaimer_text: source.disclaimer_text,
        five_g_badge: source.five_g_badge,
        swisscom_netz_hinweis: source.swisscom_netz_hinweis,
        legal_review_required: source.legal_review_required,
        restrictions: source.restrictions,

        // Briefing
        campaign_name: source.campaign_name ? `${source.campaign_name} (Kopie)` : null,
        krea_nr: null,
        produkt_kategorie: source.produkt_kategorie,
        product_link: source.product_link,
        nebenbotschaft: source.nebenbotschaft,
        zielgebiet: source.zielgebiet,
        budget: source.budget,
        order_ziel: source.order_ziel,
        ads_description: source.ads_description,
        website_bilder: source.website_bilder,
        sonstiges_sujet: source.sonstiges_sujet,
        infos_umsetzung: source.infos_umsetzung,
        umsetzung: source.umsetzung,

        // Tracking
        total_tokens_used: 0,
        total_api_cost_chf: 0,

        // Klon-Referenz
        cloned_from_id: sourceId,
      })
      .select()
      .single();

    if (error) throw new Error(`Klonen fehlgeschlagen: ${error.message}`);

    await logAuditEvent(cloned.id, "campaign_cloned", {
      source_campaign_id: sourceId,
      source_promo_id: source.promo_id,
    });

    return NextResponse.json({ campaign: cloned });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
