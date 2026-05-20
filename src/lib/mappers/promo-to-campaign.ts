import type { PromoInput } from "@/lib/schemas/promo-input";
import type { Campaign } from "@/types/database";

type CampaignInsert = Omit<
  Campaign,
  "id" | "created_at" | "updated_at" | "published_at" | "total_tokens_used" | "total_api_cost_chf"
>;

// PromoInput (verschachtelt, 6 Sektionen) -> Campaign (flach) fuer DB-Insert
export function mapPromoInputToCampaign(input: PromoInput): CampaignInsert {
  // Aktive Kanaele als String-Array extrahieren
  const channels: string[] = [];
  const ch = input.vermarktung.massnahmen;
  if (ch.print.enabled) channels.push("print");
  if (ch.digital.enabled) channels.push("digital");
  if (ch.sea.enabled) channels.push("sea");
  if (ch.social_organic.enabled) channels.push("social_organic");
  if (ch.crm.enabled) channels.push("crm");
  if (ch.ooh.enabled) channels.push("ooh");
  if (ch.pos.enabled) channels.push("pos");

  return {
    // Sektion 0: Kampagne
    promo_id: input.kampagne.id,
    campaign_name: input.kampagne.name,
    brand: input.kampagne.meta.brand,
    campaign_type: input.kampagne.meta.campaign_type,
    status: "input_complete",
    created_by: input.kampagne.meta.created_by ?? null,
    krea_nr: input.kampagne.krea_nr ?? null,
    produkt_kategorie: input.kampagne.produkt_kategorie,
    start_date: input.kampagne.datum_von,
    end_date: input.kampagne.datum_bis,

    // Sektion 1: Produktuebersicht
    product_name: input.produktuebersicht.produkt,
    product_type: input.produktuebersicht.produkt_typ,
    product_sku: input.produktuebersicht.sku ?? null,
    product_features: input.produktuebersicht.features,
    product_network: input.produktuebersicht.network ?? null,
    product_link: input.produktuebersicht.link ?? null,

    // Pricing
    price_old: input.produktuebersicht.promoangebot.price_old ?? null,
    price_new: input.produktuebersicht.promoangebot.price_new,
    currency: input.produktuebersicht.promoangebot.currency,
    price_suffix: input.produktuebersicht.promoangebot.price_suffix,
    discount_type: input.produktuebersicht.promoangebot.discount_type ?? null,
    discount_value: input.produktuebersicht.promoangebot.discount_value ?? null,
    discount_display: input.produktuebersicht.promoangebot.discount_display ?? null,
    discount_duration: input.produktuebersicht.konditionen.duration ?? null,
    price_conditions: input.produktuebersicht.konditionen.conditions ?? null,

    // Sektion 2: Vermarktung
    target_audiences: input.vermarktung.zielgruppe,
    campaign_narrative: input.vermarktung.hauptbotschaft ?? null,
    nebenbotschaft: input.vermarktung.nebenbotschaft ?? null,
    zielgebiet: input.vermarktung.zielgebiet ?? null,
    claim_direction: input.vermarktung.claim_direction,
    budget: input.vermarktung.budget ?? null,
    order_ziel: input.vermarktung.order_ziel ?? null,
    channels,
    languages: input.vermarktung.languages,

    // Sektion 3: Sujets
    ads_description: input.sujets.ads ?? null,
    website_bilder: input.sujets.website_bilder,
    sonstiges_sujet: input.sujets.sonstiges_sujet ?? null,
    infos_umsetzung: input.sujets.infos_umsetzung ?? null,

    // Sektion 4: Sonstiges
    umsetzung: input.sonstiges.umsetzung ?? null,
    auftraggeber: input.sonstiges.auftraggeber ?? null,
    freigabe: input.sonstiges.freigabe ?? null,
    at_nummer: input.sonstiges.at_nummer ?? null,
    bereich: input.sonstiges.bereich ?? null,
    disclaimer_text: input.sonstiges.disclaimer_text ?? null,
    five_g_badge: input.sonstiges.five_g_badge,
    swisscom_netz_hinweis: input.sonstiges.swisscom_netz_hinweis,

    // Sektion 5: Timeline
    timeline: input.timeline,

    // Globale Felder
    restrictions: input.restrictions,

    // Felder ohne direkte Input-Zuordnung
    business_goal: null,
    kpi_targets: null,
    strategy_options: null,
    selected_strategy_index: null,

    // Hero-Bild
    hero_image_asset_id: null,
  };
}
