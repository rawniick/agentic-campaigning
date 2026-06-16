import fs from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";
import type { BrandTokens } from "./loadTokens";

// Liefert das Brand-Logo als Data-URL fuer den Satori/resvg-Render.
// Bewusst PNG-Data-URL statt URL oder SVG-in-<img>: Satori fetcht keine URLs und
// resvg bettet SVG-in-<img> nicht zuverlaessig ein — PNG-Data-URLs schon.
// Der Template-Vertrag (logoSrc: string) bleibt unveraendert.
//
// Drop-in-Pfad fuer das echte Lockup: brand-assets/<slug>/logos/wingo-lockup@3x.png
// Solange das fehlt, wird ein font-freier Interim-Platzhalter aus der Primaerfarbe
// rasterisiert, damit die Pipeline nicht blockiert.

const PNG_CANDIDATES = ["logos/wingo-lockup@3x.png", "logos/wingo-lockup.png"];

export interface ResolveLogoOptions {
  baseDir?: string;
}

function findLockupPath(baseDir: string, slug: string): string | null {
  for (const rel of PNG_CANDIDATES) {
    const p = path.join(baseDir, slug, rel);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function resolveLogoSrc(
  tokens: BrandTokens,
  slug: string,
  opts: ResolveLogoOptions = {}
): string {
  const baseDir = opts.baseDir ?? path.join(process.cwd(), "brand-assets");

  const found = findLockupPath(baseDir, slug);
  if (found) {
    const b64 = fs.readFileSync(found).toString("base64");
    return `data:image/png;base64,${b64}`;
  }

  return interimLogoDataUrl(tokens.colors.primary.hex);
}

// True, wenn KEIN echtes Lockup-PNG vorliegt und resolveLogoSrc auf den
// font-freien Interim-Platzhalter zurueckfaellt. Die Gallery nutzt das, um zu
// warnen, dass die gerenderten Assets NICHT brand-konform sind (KO-Kriterium:
// fehlende/falsche Logos = Asset wertlos) — damit niemand Platzhalter-Assets
// fuer final haelt und ausliefert.
export function logoIsPlaceholder(
  slug: string,
  opts: ResolveLogoOptions = {}
): boolean {
  const baseDir = opts.baseDir ?? path.join(process.cwd(), "brand-assets");
  return findLockupPath(baseDir, slug) === null;
}

// Font-freier Platzhalter: resvg rendert <text> nur mit geladenen Fonts, daher
// reine Shapes — ein brand-farbener Chip mit weisser Aussparung, klar als Interim
// erkennbar. Wird als PNG rasterisiert (zuverlaessig in Satori/resvg).
function interimLogoDataUrl(hex: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="72">` +
    `<rect x="0" y="0" width="240" height="72" rx="12" fill="${hex}"/>` +
    `<rect x="20" y="28" width="140" height="16" rx="8" fill="#FFFFFF"/>` +
    `</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 240 } })
    .render()
    .asPng();
  return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
}
