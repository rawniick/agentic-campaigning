import { z } from "zod";

// Brief-Struktur nach C:\Users\nicol\Desktop\Briefing_Struktur.docx (6 Sektionen).
// V1 Wingo: Flash Sale + Standard. Andere Arten (Regio/FTTH/ATL/Black November) sind im Enum vorbereitet aber
// werden in Phase 1 nicht durch Templates abgedeckt.

export const KAMPAGNEN_ARTEN = [
  "flash_sale",
  "standard",
  "regio",
  "ftth",
  "atl_trade",
  "atl_awareness",
  "black_november",
] as const;

export const PRODUKT_KATEGORIEN = ["mobile", "internet", "tv"] as const;

// Zielgruppe = demografische Steuerung des Channel-Mix laut Grilling 2026-05-20
// (Sozial = Jung, Rational = Aelter, Nativ = Editorial-Lesende)
export const ZIELGRUPPEN = ["sozial", "rational", "nativ"] as const;

export const ZIELGEBIETE = [
  "deutschschweiz",
  "westschweiz",
  "it_schweiz",
  "ganze_schweiz",
] as const;

export const briefSchema = z.object({
  kampagne: z.object({
    name: z.string().min(1, "Kampagnenname Pflicht"),
    art: z.enum(KAMPAGNEN_ARTEN),
    datum_von: z.string().min(1, "Startdatum Pflicht"),
    datum_bis: z.string().min(1, "Enddatum Pflicht"),
    produkt_kategorie: z.enum(PRODUKT_KATEGORIEN),
  }),
  produkt: z.object({
    name: z.string().min(1, "Produktname Pflicht"),
    website_link: z.string().url().optional(),
    preis_promo: z.number().min(0),
    preis_standard: z.number().min(0).optional(),
    preis_suffix: z.string().default("/Mt."),
    konditionen: z.string().optional(),
  }),
  strategie: z.object({
    input: z.string().min(1, "Strategischer Input Pflicht"),
  }),
  vermarktung: z.object({
    hauptbotschaft: z.string().min(1, "Hauptbotschaft Pflicht"),
    nebenbotschaft: z.string().optional(),
    zielgruppe: z.enum(ZIELGRUPPEN),
    zielgebiet: z.enum(ZIELGEBIETE),
    massnahmen: z.string().optional(),
    budget: z.string().optional(),
    order_ziel: z.string().optional(),
  }),
  assets_kanaele: z.object({
    channel_kategorien: z.array(z.string()).default([]),
    format_codes: z.array(z.string()).min(1, "Mindestens 1 Format waehlen"),
  }),
  sonstiges: z
    .object({
      umsetzung: z.string().optional(),
      auftraggeber: z.string().optional(),
    })
    .default({}),
});

export type Brief = z.infer<typeof briefSchema>;
export type KampagnenArt = (typeof KAMPAGNEN_ARTEN)[number];
export type ProduktKategorie = (typeof PRODUKT_KATEGORIEN)[number];
export type Zielgruppe = (typeof ZIELGRUPPEN)[number];
export type Zielgebiet = (typeof ZIELGEBIETE)[number];
