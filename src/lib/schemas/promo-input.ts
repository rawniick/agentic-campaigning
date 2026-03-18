import { z } from "zod";

// Promo-ID Format: XXX-YYYY-WXX-NNN (Brand-Kuerzel beliebig)
const promoIdPattern = /^[A-Z]{2,5}-[0-9]{4}-W[0-9]{2}-[0-9]{3}$/;

export const channelConfigSchema = z.object({
  print: z
    .object({
      enabled: z.boolean().default(false),
      formats: z
        .array(
          z.enum([
            "fust_inserat",
            "id_inserat",
            "pos_plakat",
            "flyer",
            "beilage",
            "zeitungsinserat",
            "prospekt",
          ])
        )
        .default([]),
    })
    .default({ enabled: false, formats: [] }),
  digital: z
    .object({
      enabled: z.boolean().default(true),
      formats: z
        .array(
          z.enum([
            "display_banner",
            "social_feed",
            "social_story",
            "newsletter_banner",
            "website_teaser",
            "website_hero",
          ])
        )
        .default([]),
    })
    .default({ enabled: true, formats: [] }),
  sea: z
    .object({
      enabled: z.boolean().default(false),
      platforms: z.array(z.enum(["google", "bing"])).default([]),
    })
    .default({ enabled: false, platforms: [] }),
  social_organic: z
    .object({
      enabled: z.boolean().default(false),
      platforms: z
        .array(z.enum(["instagram", "facebook", "linkedin", "tiktok"]))
        .default([]),
    })
    .default({ enabled: false, platforms: [] }),
  crm: z
    .object({
      enabled: z.boolean().default(false),
      types: z
        .array(z.enum(["newsletter", "trigger_mail", "push_notification"]))
        .default([]),
    })
    .default({ enabled: false, types: [] }),
  ooh: z
    .object({
      enabled: z.boolean().default(false),
      formats: z
        .array(
          z.enum([
            "plakat_f4",
            "plakat_f12",
            "plakat_f200",
            "dooh_screen",
            "citylights",
          ])
        )
        .default([]),
    })
    .default({ enabled: false, formats: [] }),
  pos: z
    .object({
      enabled: z.boolean().default(false),
      formats: z
        .array(
          z.enum(["pos_plakat", "digital_signage", "kassen_asset", "alarmcover"])
        )
        .default([]),
    })
    .default({ enabled: false, formats: [] }),
});

// Timeline-Eintrag: Datum + Beschreibung
export const timelineEntrySchema = z.object({
  datum: z.string().min(1, "Datum ist Pflicht"),
  beschreibung: z.string().min(1, "Beschreibung ist Pflicht"),
});

// Briefing-Struktur: 6 Sektionen
export const promoInputSchema = z.object({
  // === Sektion 0: Kampagne ===
  kampagne: z.object({
    name: z.string().min(1, "Kampagnenname ist Pflicht"),
    datum_von: z.string().min(1, "Startdatum ist Pflicht"),
    datum_bis: z.string().min(1, "Enddatum ist Pflicht"),
    produkt_kategorie: z.enum(["tv", "internet", "mobile", "bundle", "other"]).default("mobile"),
    id: z.string().regex(promoIdPattern, "Format: XXX-YYYY-WXX-NNN (z.B. ACE-2026-W10-001)"),
    krea_nr: z.string().optional(),
    meta: z.object({
      brand: z.string().min(1, "Brand ist Pflicht"),
      campaign_type: z.enum([
        "aktionswoche",
        "themenpromo",
        "standardpromo",
        "saisonpromo",
        "launch",
      ]),
      status: z
        .enum([
          "draft",
          "input_complete",
          "in_generation",
          "in_review",
          "approved",
          "published",
          "archived",
        ])
        .default("draft"),
      created_by: z.string().optional(),
      priority: z.enum(["normal", "express", "urgent"]).default("normal"),
    }),
  }),

  // === Sektion 1: Produktuebersicht ===
  produktuebersicht: z.object({
    produkt: z.string().min(1, "Produktname ist Pflicht"),
    produkt_typ: z.enum(["abo", "prepaid", "hardware", "bundle", "option"]),
    sku: z.string().optional(),
    link: z.string().optional(),
    promoangebot: z.object({
      price_old: z.number().min(0).optional(),
      price_new: z.number().min(0),
      currency: z.literal("CHF").default("CHF"),
      price_suffix: z.enum(["/Mt.", "/Jahr", "einmalig", ""]).default("/Mt."),
      discount_type: z
        .enum(["percentage", "absolute", "special", "none"])
        .optional(),
      discount_value: z.number().optional(),
      discount_display: z.string().optional(),
    }),
    konditionen: z.object({
      duration: z
        .enum([
          "lebenslang",
          "24_monate",
          "12_monate",
          "6_monate",
          "3_monate",
          "einmalig",
        ])
        .optional(),
      conditions: z.string().optional(),
    }).default({}),
    features: z.array(z.string()).default([]),
    network: z.enum(["5g_swisscom", "4g_swisscom", "other"]).optional(),
  }),

  // === Sektion 2: Vermarktung ===
  vermarktung: z.object({
    hauptbotschaft: z.string().optional(),
    nebenbotschaft: z.string().optional(),
    zielgruppe: z
      .array(
        z.enum([
          "neukunden",
          "bestandskunden",
          "jugendliche",
          "familien",
          "senioren",
          "geschaeftskunden",
          "alle",
        ])
      )
      .default([]),
    zielgebiet: z.string().optional(),
    massnahmen: channelConfigSchema,
    budget: z.string().optional(),
    order_ziel: z.string().optional(),
    claim_direction: z
      .enum(["preis_fokus", "feature_fokus", "emotional", "vergleich", "auto"])
      .default("auto"),
    languages: z
      .array(z.enum(["de", "fr", "it", "en"]))
      .min(1)
      .default(["de", "fr", "it"]),
  }),

  // === Sektion 3: Sujets ===
  sujets: z.object({
    ads: z.string().optional(),
    website_bilder: z.boolean().default(false),
    sonstiges_sujet: z.string().optional(),
    infos_umsetzung: z.string().optional(),
  }).default({ website_bilder: false }),

  // === Sektion 4: Sonstiges ===
  sonstiges: z.object({
    umsetzung: z.string().optional(),
    auftraggeber: z.string().optional(),
    freigabe: z.string().optional(),
    at_nummer: z.string().optional(),
    bereich: z.string().optional(),
    disclaimer_required: z.boolean().default(true),
    disclaimer_text: z.string().optional(),
    five_g_badge: z.boolean().default(false),
    swisscom_netz_hinweis: z.boolean().default(true),
    legal_review_required: z.boolean().default(false),
    additional_legal: z.array(z.string()).default([]),
  }).default({
    disclaimer_required: true,
    five_g_badge: false,
    swisscom_netz_hinweis: true,
    legal_review_required: false,
    additional_legal: [],
  }),

  // === Sektion 5: Timeline ===
  timeline: z.array(timelineEntrySchema).default([]),

  // Globale Felder (rueckwaertskompatibel)
  restrictions: z.array(z.string()).default([]),

  references: z
    .object({
      previous_campaign_id: z.string().optional(),
      asset_references: z.array(z.string()).default([]),
      notes: z.string().optional(),
    })
    .optional(),
});

export type PromoInput = z.infer<typeof promoInputSchema>;
export type ChannelConfig = z.infer<typeof channelConfigSchema>;
export type TimelineEntry = z.infer<typeof timelineEntrySchema>;
