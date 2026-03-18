import type { PromoInput } from "@/lib/schemas/promo-input";
import type { Campaign } from "@/types/database";

// Campaign (flach) → PromoInput (verschachtelt, 6 Sektionen) fuer Prompt-Context
export function mapCampaignToPromoInput(campaign: Campaign): PromoInput {
  return {
    // Sektion 0: Kampagne
    kampagne: {
      name: campaign.campaign_name ?? campaign.product_name,
      datum_von: campaign.start_date ?? "",
      datum_bis: campaign.end_date ?? "",
      produkt_kategorie: (campaign.produkt_kategorie as PromoInput["kampagne"]["produkt_kategorie"]) ?? "mobile",
      id: campaign.promo_id,
      krea_nr: campaign.krea_nr ?? undefined,
      meta: {
        brand: campaign.brand,
        campaign_type: campaign.campaign_type as PromoInput["kampagne"]["meta"]["campaign_type"],
        status: "input_complete",
        created_by: campaign.created_by ?? undefined,
        priority: "normal",
      },
    },

    // Sektion 1: Produktuebersicht
    produktuebersicht: {
      produkt: campaign.product_name,
      produkt_typ: campaign.product_type as PromoInput["produktuebersicht"]["produkt_typ"],
      sku: campaign.product_sku ?? undefined,
      link: campaign.product_link ?? undefined,
      promoangebot: {
        price_old: campaign.price_old != null ? Number(campaign.price_old) : undefined,
        price_new: Number(campaign.price_new),
        currency: "CHF",
        price_suffix: campaign.price_suffix as PromoInput["produktuebersicht"]["promoangebot"]["price_suffix"],
        discount_type: (campaign.discount_type as PromoInput["produktuebersicht"]["promoangebot"]["discount_type"]) ?? undefined,
        discount_value: campaign.discount_value != null ? Number(campaign.discount_value) : undefined,
        discount_display: campaign.discount_display ?? undefined,
      },
      konditionen: {
        duration: (campaign.discount_duration as NonNullable<PromoInput["produktuebersicht"]["konditionen"]>["duration"]) ?? undefined,
        conditions: campaign.price_conditions ?? undefined,
      },
      features: campaign.product_features,
      network: (campaign.product_network as PromoInput["produktuebersicht"]["network"]) ?? undefined,
    },

    // Sektion 2: Vermarktung
    vermarktung: {
      hauptbotschaft: campaign.campaign_narrative ?? undefined,
      nebenbotschaft: campaign.nebenbotschaft ?? undefined,
      zielgruppe: campaign.target_audiences as PromoInput["vermarktung"]["zielgruppe"],
      zielgebiet: campaign.zielgebiet ?? undefined,
      massnahmen: buildChannelsFromArray(campaign.channels),
      budget: campaign.budget ?? undefined,
      order_ziel: campaign.order_ziel ?? undefined,
      claim_direction: (campaign.claim_direction as PromoInput["vermarktung"]["claim_direction"]) ?? "auto",
      languages: campaign.languages as PromoInput["vermarktung"]["languages"],
    },

    // Sektion 3: Sujets
    sujets: {
      ads: campaign.ads_description ?? undefined,
      website_bilder: campaign.website_bilder ?? false,
      sonstiges_sujet: campaign.sonstiges_sujet ?? undefined,
      infos_umsetzung: campaign.infos_umsetzung ?? undefined,
    },

    // Sektion 4: Sonstiges (inkl. Compliance)
    sonstiges: {
      umsetzung: campaign.umsetzung ?? undefined,
      auftraggeber: campaign.auftraggeber ?? undefined,
      freigabe: campaign.freigabe ?? undefined,
      at_nummer: campaign.at_nummer ?? undefined,
      bereich: campaign.bereich ?? undefined,
      disclaimer_required: !!campaign.disclaimer_text,
      disclaimer_text: campaign.disclaimer_text ?? undefined,
      five_g_badge: campaign.five_g_badge,
      swisscom_netz_hinweis: campaign.swisscom_netz_hinweis,
      legal_review_required: campaign.legal_review_required,
      additional_legal: [],
    },

    // Sektion 5: Timeline
    timeline: campaign.timeline ?? [],

    restrictions: campaign.restrictions,
  };
}

// Kanal-Array zurueck in verschachtelte ChannelConfig mappen
function buildChannelsFromArray(channels: string[]): PromoInput["vermarktung"]["massnahmen"] {
  return {
    print: { enabled: channels.includes("print"), formats: [] },
    digital: { enabled: channels.includes("digital"), formats: [] },
    sea: { enabled: channels.includes("sea"), platforms: [] },
    social_organic: { enabled: channels.includes("social_organic"), platforms: [] },
    crm: { enabled: channels.includes("crm"), types: [] },
    ooh: { enabled: channels.includes("ooh"), formats: [] },
    pos: { enabled: channels.includes("pos"), formats: [] },
  };
}
