// Preise MUESSEN exakt Input matchen - keine Rundungen, keine Aenderungen
export interface PriceValidationResult {
  valid: boolean;
  issues: PriceIssue[];
}

export interface PriceIssue {
  field: string;
  expected: string;
  found: string;
  severity: "CRITICAL";
}

interface PriceInput {
  price_new: number;
  price_old?: number;
  currency?: string;
  price_suffix?: string;
  discount_display?: string;
  discount_value?: number;
}

// Alle Preisnennungen im generierten Text pruefen
export function validatePrices(
  generatedText: string,
  input: PriceInput
): PriceValidationResult {
  const issues: PriceIssue[] = [];

  // Preis-Strings die im Output vorkommen muessen
  const expectedPriceNew = formatPrice(input.price_new);
  if (!generatedText.includes(expectedPriceNew)) {
    // Auch ohne fuehrendes CHF pruefen
    const priceOnly = input.price_new.toFixed(2);
    if (!generatedText.includes(priceOnly)) {
      issues.push({
        field: "price_new",
        expected: expectedPriceNew,
        found: "nicht gefunden im Output",
        severity: "CRITICAL",
      });
    }
  }

  // Alter Preis pruefen
  if (input.price_old !== undefined) {
    const expectedPriceOld = formatPrice(input.price_old);
    const priceOldOnly = input.price_old.toFixed(2);
    if (
      !generatedText.includes(expectedPriceOld) &&
      !generatedText.includes(priceOldOnly)
    ) {
      issues.push({
        field: "price_old",
        expected: expectedPriceOld,
        found: "nicht gefunden im Output",
        severity: "CRITICAL",
      });
    }
  }

  // Rabatt-Anzeige pruefen
  if (input.discount_display) {
    if (!generatedText.includes(input.discount_display)) {
      issues.push({
        field: "discount_display",
        expected: input.discount_display,
        found: "nicht gefunden im Output",
        severity: "CRITICAL",
      });
    }
  }

  // Rabatt mathematisch pruefen
  if (
    input.price_old !== undefined &&
    input.discount_value !== undefined &&
    input.price_old > 0
  ) {
    const calculatedDiscount =
      Math.round((1 - input.price_new / input.price_old) * 100 * 100) / 100;
    if (Math.abs(calculatedDiscount - input.discount_value) > 0.5) {
      issues.push({
        field: "discount_math",
        expected: `${input.discount_value}%`,
        found: `Berechnet: ${calculatedDiscount}% (basierend auf ${input.price_old} -> ${input.price_new})`,
        severity: "CRITICAL",
      });
    }
  }

  // Gerundete Preise erkennen (verboten!)
  const roundedNew = Math.round(input.price_new);
  if (roundedNew !== input.price_new) {
    const roundedStr = `${roundedNew}.-`;
    const roundedStr2 = `${roundedNew}.–`;
    const roundedStr3 = `${roundedNew}.00`;
    if (
      generatedText.includes(roundedStr) ||
      generatedText.includes(roundedStr2) ||
      generatedText.includes(roundedStr3)
    ) {
      issues.push({
        field: "price_rounded",
        expected: input.price_new.toFixed(2),
        found: `Gerundeter Preis ${roundedNew} gefunden (VERBOTEN)`,
        severity: "CRITICAL",
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

function formatPrice(price: number): string {
  return `CHF ${price.toFixed(2)}`;
}

// JSON-Output rekursiv nach Preiswerten durchsuchen
export function extractPricesFromJson(
  obj: unknown,
  prices: string[] = []
): string[] {
  if (typeof obj === "string") {
    // CHF-Betraege extrahieren
    const matches = obj.match(/CHF\s*[\d]+[.,][\d]{2}/g);
    if (matches) prices.push(...matches);
    return prices;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractPricesFromJson(item, prices);
    }
    return prices;
  }

  if (typeof obj === "object" && obj !== null) {
    for (const value of Object.values(obj)) {
      extractPricesFromJson(value, prices);
    }
  }

  return prices;
}
