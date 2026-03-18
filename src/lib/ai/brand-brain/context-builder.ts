import type { BrandBrainFiles, GlossarData, GoldenExample, CIRules } from "./loader";
import { loadBrandBrain } from "./loader";
import type { PromoInput } from "@/lib/schemas/promo-input";

// Modular: Shared (Compliance, Pricing) + Brand (Tone, Glossar) + Campaign + Examples + Visual
export interface PromptContext {
  systemContext: string;
  brandContext: string;
  campaignContext: string;
  glossarContext: string;
  complianceContext: string;
  goldenExamplesContext: string;
  visualContext: string;
}

// Glossar als lesbaren Text fuer Prompt formatieren
function formatGlossar(glossar: GlossarData): string {
  const entries = Object.entries(glossar.terms);
  if (entries.length === 0) return "Kein Glossar verfuegbar.";

  return entries
    .map(([term, data]) => {
      const wrongList = data.wrong.join(", ");
      return `- **${term}**: ${data.use}\n  FALSCH: ${wrongList}`;
    })
    .join("\n");
}

// Golden Examples als Few-Shot-Referenz formatieren
function formatGoldenExamples(examples: GoldenExample[]): string {
  if (examples.length === 0) return "Keine Golden Examples verfuegbar.";

  return examples.map((ex, i) => {
    const inputLines = Object.entries(ex.input)
      .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
      .join("\n");

    const outputLines: string[] = [];
    const out = ex.output;
    if (out.leitidee) outputLines.push(`  Leitidee: ${out.leitidee}`);
    if (Array.isArray(out.claims)) outputLines.push(`  Claims: ${(out.claims as string[]).join(" | ")}`);
    if (out.hero_message) outputLines.push(`  Hero: ${out.hero_message}`);

    // Kanal-Outputs kompakt darstellen
    for (const channel of ["social", "sea", "crm", "website"]) {
      if (out[channel] && typeof out[channel] === "object") {
        const ch = out[channel] as Record<string, unknown>;
        const fields = Object.entries(ch)
          .map(([k, v]) => `    ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
          .join("\n");
        outputLines.push(`  ${channel}:\n${fields}`);
      }
    }

    return `### Beispiel ${i + 1}: ${ex.campaign_name} (${ex.type})

**Input:**
${inputLines}

**Output:**
${outputLines.join("\n")}

**Bewertung:** ${ex.notes || "Keine Anmerkungen"}`;
  }).join("\n\n---\n\n");
}

// CI-Rules als lesbaren Text formatieren
function formatCIRules(ciRules: CIRules): string {
  const parts: string[] = [];

  // Farben
  const colors = ciRules.colors;
  if (colors.primary) parts.push(`Primaerfarbe: ${colors.primary_name || ""} (${colors.primary})`);
  if (colors.secondary) parts.push(`Sekundaerfarbe: ${colors.secondary_name || ""} (${colors.secondary})`);
  if (colors.accent) parts.push(`Akzentfarbe: ${colors.accent_name || ""} (${colors.accent})`);
  if (Array.isArray(colors.usage_rules)) {
    parts.push(`Farb-Regeln:\n${(colors.usage_rules as string[]).map(r => `  - ${r}`).join("\n")}`);
  }

  // Typografie
  const typo = ciRules.typography;
  if (typo.headline_font) parts.push(`Headline-Font: ${typo.headline_font}`);
  if (typo.body_font) parts.push(`Body-Font: ${typo.body_font}`);
  if (Array.isArray(typo.rules)) {
    parts.push(`Typo-Regeln:\n${(typo.rules as string[]).map(r => `  - ${r}`).join("\n")}`);
  }

  // Logo
  const logo = ciRules.logo;
  if (logo.placement) parts.push(`Logo-Platzierung: ${logo.placement}`);
  if (Array.isArray(logo.forbidden)) {
    parts.push(`Logo-Verbote:\n${(logo.forbidden as string[]).map(r => `  - ${r}`).join("\n")}`);
  }

  // Layout
  if (ciRules.layout_rules.length > 0) {
    parts.push(`Layout-Regeln:\n${ciRules.layout_rules.map(r => `  - ${r}`).join("\n")}`);
  }

  return parts.join("\n\n");
}

// Compliance-Kontext aus PromoInput ableiten (neue Pfade: sonstiges + produktuebersicht)
function buildComplianceContext(input: PromoInput): string {
  const rules: string[] = [];

  // Preise exakt
  rules.push(`Preis NEU: CHF ${input.produktuebersicht.promoangebot.price_new}${input.produktuebersicht.promoangebot.price_suffix}`);
  if (input.produktuebersicht.promoangebot.price_old) {
    rules.push(`Preis ALT: CHF ${input.produktuebersicht.promoangebot.price_old}${input.produktuebersicht.promoangebot.price_suffix}`);
  }
  if (input.produktuebersicht.promoangebot.discount_display) {
    rules.push(`Rabatt-Anzeige: ${input.produktuebersicht.promoangebot.discount_display}`);
  }

  // Pflichthinweise
  if (input.sonstiges.disclaimer_text) {
    rules.push(`Disclaimer (1:1 uebernehmen): "${input.sonstiges.disclaimer_text}"`);
  }
  if (input.sonstiges.five_g_badge) {
    rules.push('5G Badge PFLICHT: "5G im Swisscom Netz" muss in jedem Asset vorkommen');
  }
  if (input.sonstiges.swisscom_netz_hinweis) {
    rules.push('"5G im Swisscom Netz" Hinweis ist Pflicht');
  }

  // Einschraenkungen
  if (input.restrictions.length > 0) {
    rules.push(`Einschraenkungen: ${input.restrictions.join("; ")}`);
  }

  return rules.join("\n");
}

// Kampagnen-Kontext aus PromoInput (neue 6-Sektionen-Struktur)
function buildCampaignContext(input: PromoInput): string {
  const parts: string[] = [
    `Promo-ID: ${input.kampagne.id}`,
    `Kampagnenname: ${input.kampagne.name}`,
    `Marke: ${input.kampagne.meta.brand}`,
    `Kampagnentyp: ${input.kampagne.meta.campaign_type}`,
    `Produkt-Kategorie: ${input.kampagne.produkt_kategorie}`,
    `Produkt: ${input.produktuebersicht.produkt} (${input.produktuebersicht.produkt_typ})`,
  ];

  if (input.produktuebersicht.features.length > 0) {
    parts.push(`Features: ${input.produktuebersicht.features.join(", ")}`);
  }

  parts.push(`Preis: CHF ${input.produktuebersicht.promoangebot.price_new}${input.produktuebersicht.promoangebot.price_suffix}`);
  if (input.produktuebersicht.promoangebot.price_old) {
    parts.push(
      `Vorher: CHF ${input.produktuebersicht.promoangebot.price_old}${input.produktuebersicht.promoangebot.price_suffix} -> Jetzt: CHF ${input.produktuebersicht.promoangebot.price_new}${input.produktuebersicht.promoangebot.price_suffix}`
    );
  }
  if (input.produktuebersicht.promoangebot.discount_display) {
    parts.push(`Rabatt: ${input.produktuebersicht.promoangebot.discount_display}`);
  }
  if (input.produktuebersicht.konditionen.duration) {
    parts.push(`Rabatt-Dauer: ${input.produktuebersicht.konditionen.duration}`);
  }

  parts.push(`Zeitraum: ${input.kampagne.datum_von} bis ${input.kampagne.datum_bis}`);

  if (input.vermarktung.zielgruppe.length > 0) {
    parts.push(`Zielgruppen: ${input.vermarktung.zielgruppe.join(", ")}`);
  }
  if (input.vermarktung.zielgebiet) {
    parts.push(`Zielgebiet: ${input.vermarktung.zielgebiet}`);
  }
  if (input.vermarktung.hauptbotschaft) {
    parts.push(`Hauptbotschaft (Vorgabe): ${input.vermarktung.hauptbotschaft}`);
  }
  if (input.vermarktung.nebenbotschaft) {
    parts.push(`Nebenbotschaft: ${input.vermarktung.nebenbotschaft}`);
  }
  if (input.vermarktung.budget) {
    parts.push(`Budget: ${input.vermarktung.budget}`);
  }
  parts.push(`Claim-Richtung: ${input.vermarktung.claim_direction}`);

  // Aktive Kanaele
  const activeChannels: string[] = [];
  const ch = input.vermarktung.massnahmen;
  if (ch.print.enabled) activeChannels.push("Print");
  if (ch.digital.enabled) activeChannels.push("Digital");
  if (ch.sea.enabled) activeChannels.push("SEA");
  if (ch.social_organic.enabled) activeChannels.push("Social Organic");
  if (ch.crm.enabled) activeChannels.push("CRM");
  if (ch.ooh.enabled) activeChannels.push("OOH");
  if (ch.pos.enabled) activeChannels.push("POS");
  parts.push(`Aktive Kanaele: ${activeChannels.join(", ")}`);

  parts.push(`Sprachen: ${input.vermarktung.languages.join(", ")}`);

  return parts.join("\n");
}

// Vollstaendigen Prompt-Kontext zusammenbauen
export async function buildPromptContext(
  input: PromoInput,
  language: string = "de"
): Promise<PromptContext> {
  const brandBrain = await loadBrandBrain(language);

  return {
    systemContext: buildSystemContext(brandBrain),
    brandContext: brandBrain.toneOfVoice,
    campaignContext: buildCampaignContext(input),
    glossarContext: formatGlossar(brandBrain.glossar),
    complianceContext: buildComplianceContext(input),
    goldenExamplesContext: formatGoldenExamples(brandBrain.goldenExamples ?? []),
    visualContext: brandBrain.ciRules ? formatCIRules(brandBrain.ciRules) : "Keine CI-Rules verfuegbar.",
  };
}

// System-Kontext Header
function buildSystemContext(brandBrain: BrandBrainFiles): string {
  const parts = [
    "## Brand Brain geladen",
    `Glossar: ${Object.keys(brandBrain.glossar.terms).length} verbindliche Begriffe`,
    `Tone of Voice: geladen`,
  ];

  if (brandBrain.goldenExamples && brandBrain.goldenExamples.length > 0) {
    parts.push(`Golden Examples: ${brandBrain.goldenExamples.length} Referenz-Kampagnen eingebunden`);
  }

  if (brandBrain.ciRules) {
    parts.push(`CI-Rules: geladen (${brandBrain.ciRules._meta.brand})`);
  }

  return parts.join("\n");
}
