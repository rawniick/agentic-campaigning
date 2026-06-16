import sharp from "sharp";

// Deterministischer Brand-Konformitaets-Check pro gerendertem Asset. Anders als die
// Claude-Vision-QA (eine LLM-Meinung, best-effort, advisory) ist DIES der harte,
// reproduzierbare Gate, der das KO-Kriterium "100% Brand-Konformitaet" durchsetzt:
// failt ein Check, darf das Asset NICHT als final ausgeliefert werden.
//
// Geprueft (hart): Logo-Vorhandensein (echtes Lockup vs. Interim-Platzhalter),
// Asset-Dimensionen, Brand-Primaerfarbe vorhanden.
// BEWUSST der advisory Vision-QA ueberlassen / vertagt: Logo-VERZERRUNG (Aspect-Ratio,
// laut Brand-Manual ein Vision-QA-Check) und die AI-Label-Pflicht (greift erst mit
// AI-Bildgenerierung, derzeit out-of-scope — TODO sobald hero_source='ai' moeglich).

export interface ConformityInput {
  pngBytes: Buffer;
  expectedWidth: number;
  expectedHeight: number;
  brandPrimaryHex: string;
  // true, wenn der Render auf den Interim-Logo-Platzhalter zurueckfiel (kein echtes
  // Wingo-Lockup). Property des Render-Inputs, nicht des Pixel-Outputs.
  logoIsPlaceholder: boolean;
}

export interface ConformityCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface ConformityResult {
  pass: boolean;
  checks: ConformityCheck[];
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "").trim();
  // Kurzform #RGB → #RRGGBB; 8-stellig #RRGGBBAA → Alpha ignorieren.
  // (loadTokens erlaubt per Schema 3-, 6- und 8-stellige Hex.)
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const COLOR_TOLERANCE = 24; // pro Kanal (JPEG/Resampling-Drift)
// Auf eine kleine Probe runterskalieren: begrenzt den Scan auf O(96^2) (statt bis
// zu 2 MP x 44 Assets) UND mittelt einzelne Streupixel (Antialiasing/JPEG-Artefakte)
// weg, sodass nicht schon EIN zufaellig rotes Pixel den Check besteht.
const PROBE_MAX_DIM = 96;
const MIN_MATCH_PIXELS = 3;

async function brandColorPresent(
  pngBytes: Buffer,
  target: { r: number; g: number; b: number }
): Promise<boolean> {
  const { data, info } = await sharp(pngBytes)
    .resize({
      width: PROBE_MAX_DIM,
      height: PROBE_MAX_DIM,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  let matches = 0;
  for (let i = 0; i + 2 < data.length; i += ch) {
    if (
      Math.abs(data[i] - target.r) <= COLOR_TOLERANCE &&
      Math.abs(data[i + 1] - target.g) <= COLOR_TOLERANCE &&
      Math.abs(data[i + 2] - target.b) <= COLOR_TOLERANCE
    ) {
      matches++;
      if (matches >= MIN_MATCH_PIXELS) return true;
    }
  }
  return false;
}

export async function checkBrandConformity(
  input: ConformityInput
): Promise<ConformityResult> {
  const checks: ConformityCheck[] = [];

  // 1. Echtes Logo (KO-Kriterium): kein Interim-Platzhalter.
  checks.push({
    name: "logo_present",
    pass: !input.logoIsPlaceholder,
    detail: input.logoIsPlaceholder
      ? "Platzhalter-Logo — echtes Wingo-Lockup fehlt"
      : undefined,
  });

  // Pixel-Checks: ein nicht dekodierbares PNG ist nicht konform (fail, kein Throw —
  // sonst koennte ein kaputter Render still durchrutschen). Beide Checks erst NACH
  // erfolgreichem Decode pushen, damit die Details bei einem Teil-Decode-Fehler
  // nicht inkonsistent werden (sonst dimensions=pass + brand_color fehlt).
  try {
    const meta = await sharp(input.pngBytes).metadata();
    const colorOk = await brandColorPresent(
      input.pngBytes,
      hexToRgb(input.brandPrimaryHex)
    );

    // 2. Dimensionen == Format-Spec (kein verzerrtes/falsch skaliertes Format).
    const dimOk =
      meta.width === input.expectedWidth && meta.height === input.expectedHeight;
    checks.push({
      name: "dimensions",
      pass: dimOk,
      detail: dimOk
        ? undefined
        : `${meta.width}x${meta.height} != ${input.expectedWidth}x${input.expectedHeight}`,
    });

    // 3. Brand-Primaerfarbe vorhanden (Akzent: Preis/CTA/Stern). Fehlt sie komplett,
    //    ist das Brand-Mechanik-Element nicht gerendert.
    checks.push({
      name: "brand_color",
      pass: colorOk,
      detail: colorOk
        ? undefined
        : `Primaerfarbe ${input.brandPrimaryHex} nicht im Asset gefunden`,
    });
  } catch (e) {
    checks.push({
      name: "decodable",
      pass: false,
      detail: `Asset-PNG nicht dekodierbar: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  return { pass: checks.every((c) => c.pass), checks };
}
