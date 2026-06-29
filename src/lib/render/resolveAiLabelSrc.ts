import fs from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";

// Liefert das AI-Label-Asset als PNG-Data-URL fuer den Satori/resvg-Render.
// Pflicht-Brand-Asset auf JEDEM AI-generierten Sujet (Brand Manual). Wie beim
// Logo: Satori fetcht keine URLs, daher PNG-Data-URL statt storage_url. Der
// AiLabelOverlay-Vertrag (src: string) bleibt unveraendert — runMultiplex
// ueberschreibt das DB-storage_url mit dem hier aufgeloesten Data-URL.
//
// Drop-in-Pfad fuer das offizielle Asset:
//   brand-assets/<slug>/ai-label/wingo-ai-label@3x.png  (oder wingo-ai-label.png)
// Solange das fehlt, wird ein font-freier Interim-Badge rasterisiert, damit die
// AI-Pipeline nicht blockiert (KO: das offizielle "Mit KI erstellt"-Asset muss
// ihn vor dem echten Go-Live ersetzen).

export interface ResolveAiLabelOptions {
  baseDir?: string;
}

const AI_LABEL_CANDIDATES = [
  "ai-label/wingo-ai-label@3x.png",
  "ai-label/wingo-ai-label.png",
];

function findAiLabelPath(baseDir: string, slug: string): string | null {
  for (const rel of AI_LABEL_CANDIDATES) {
    const p = path.join(baseDir, slug, rel);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function resolveAiLabelSrc(
  slug: string,
  opts: ResolveAiLabelOptions = {}
): string {
  const baseDir = opts.baseDir ?? path.join(process.cwd(), "brand-assets");

  const found = findAiLabelPath(baseDir, slug);
  if (found) {
    const b64 = fs.readFileSync(found).toString("base64");
    return `data:image/png;base64,${b64}`;
  }

  return interimAiLabelDataUrl();
}

// True, wenn KEIN offizielles AI-Label-PNG vorliegt und resolveAiLabelSrc den
// Interim-Badge nutzt. Analog zu logoIsPlaceholder — die Gallery/HANDOFF nutzt
// das, um zu signalisieren, dass AI-Assets noch nicht final auslieferbar sind.
export function aiLabelIsPlaceholder(
  slug: string,
  opts: ResolveAiLabelOptions = {}
): boolean {
  const baseDir = opts.baseDir ?? path.join(process.cwd(), "brand-assets");
  return findAiLabelPath(baseDir, slug) === null;
}

// Font-freier Interim-Badge (resvg rendert <text> nur mit geladenen Fonts, daher
// reine Shapes): dunkle Pille mit weissem Sparkle-Glyph + heller "Label"-Leiste —
// klar als AI-Kennzeichnungs-Platzhalter erkennbar. Als PNG rasterisiert
// (zuverlaessig in Satori/resvg, kein SVG-in-<img>).
function interimAiLabelDataUrl(): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="56">` +
    `<rect x="0" y="0" width="192" height="56" rx="28" fill="#111827"/>` +
    `<path d="M34,14 L38,24 L48,28 L38,32 L34,42 L30,32 L20,28 L30,24 Z" fill="#FFFFFF"/>` +
    `<rect x="58" y="22" width="110" height="12" rx="6" fill="#FFFFFF" fill-opacity="0.85"/>` +
    `</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 192 } })
    .render()
    .asPng();
  return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
}
