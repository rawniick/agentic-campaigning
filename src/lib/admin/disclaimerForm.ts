// Pure-Parser fuer das Disclaimer-Admin-Formular (FormData -> getypte Werte).
// Bewusst ohne Zod-Transform-Magie, damit die fehleranfaelligen Teile (Conditions-
// JSON, Kategorien-Liste, Checkboxen) direkt testbar sind und klare Fehler werfen.

export interface DisclaimerFormValues {
  slug: string;
  name: string;
  conditions_json: Record<string, unknown>;
  applies_to_categories: string[];
  text_de: string;
  text_fr: string;
  text_it: string;
  text_en: string;
  is_required: boolean;
  is_active: boolean;
}

function reqText(v: unknown, label: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new Error(`${label} fehlt`);
  return s;
}

function parseConditions(v: unknown): Record<string, unknown> {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch {
    throw new Error("Conditions sind kein gueltiges JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error('Conditions muessen ein JSON-Objekt sein, z.B. {"network":"5g"}');
  }
  return parsed as Record<string, unknown>;
}

// Gueltige Produkt-Kategorien (= ProductContext.category / products z.enum).
// Validierung HIER ist compliance-kritisch: ein Tippfehler (z.B. "tvv") wuerde
// sonst still gespeichert und der Disclaimer matcht nie -> Pflichttext fehlt
// lautlos in allen 44 Assets.
export const VALID_CATEGORIES = ["mobile", "tv", "internet"] as const;

function parseCategories(v: unknown): string[] {
  const s = typeof v === "string" ? v : "";
  const cats = s
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const unknown = cats.filter(
    (c) => !(VALID_CATEGORIES as readonly string[]).includes(c)
  );
  if (unknown.length > 0) {
    throw new Error(
      `Unbekannte Kategorie(n): ${unknown.join(", ")}. Erlaubt: ${VALID_CATEGORIES.join(", ")} (leer = alle).`
    );
  }
  return cats;
}

// Checkbox: gesetzt -> FormData liefert "on"; nicht gesetzt -> Key fehlt -> false.
function checkbox(v: unknown): boolean {
  return v === "on" || v === "true" || v === true;
}

export function parseDisclaimerForm(
  raw: Record<string, unknown>
): DisclaimerFormValues {
  return {
    slug: reqText(raw.slug, "Slug"),
    name: reqText(raw.name, "Name"),
    conditions_json: parseConditions(raw.conditions_json),
    applies_to_categories: parseCategories(raw.applies_to_categories),
    text_de: reqText(raw.text_de, "Text DE"),
    text_fr: reqText(raw.text_fr, "Text FR"),
    text_it: reqText(raw.text_it, "Text IT"),
    text_en: reqText(raw.text_en, "Text EN"),
    is_required: checkbox(raw.is_required),
    is_active: checkbox(raw.is_active),
  };
}
