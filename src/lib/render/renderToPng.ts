import fs from "fs";
import path from "path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { ReactElement } from "react";

export interface RenderToPngOptions {
  width: number;
  height: number;
  brandAssetsDir?: string;
}

interface FontEntry {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: "normal";
}

let cachedFonts: FontEntry[] | null = null;

// Erstes Font-File im Verzeichnis, das auf `re` matcht (otf/ttf/woff). Robust
// gegen Hash-Suffixe im Dateinamen (z.B. RadikalTrial-Bold-BF642254c05f85f.otf).
function findFontFile(dir: string, re: RegExp): string | null {
  if (!fs.existsSync(dir)) return null;
  for (const f of fs.readdirSync(dir)) {
    if (re.test(f) && /\.(otf|ttf|woff2?)$/i.test(f)) return path.join(dir, f);
  }
  return null;
}

// Laedt die Wingo-Headline-Font (Radikal) Regular + Bold aus
// /brand-assets/wingo/fonts/. Tests und Production teilen sich diesen Cache: der
// Renderer ist process-lokal, also einmal pro Worker. Satori matched per
// Family-Name + Weight und faellt sonst auf die geladene Font zurueck — der
// Family-Name in tokens.json (Fixtures: WingoSans-Bold) muss also nicht exakt
// "Radikal" sein, die Weights (400/700) werden trotzdem korrekt aufgeloest.
function loadFonts(brandAssetsDir?: string): FontEntry[] {
  if (cachedFonts) return cachedFonts;

  const baseDir =
    brandAssetsDir ?? path.join(process.cwd(), "brand-assets", "wingo", "fonts");

  const regularPath =
    findFontFile(baseDir, /radikal.*regular/i) ?? findFontFile(baseDir, /regular/i);
  const boldPath =
    findFontFile(baseDir, /radikal.*bold/i) ?? findFontFile(baseDir, /bold/i);

  if (!regularPath || !boldPath) {
    throw new Error(
      `Required brand fonts missing in ${baseDir} (need a Regular + a Bold .otf/.ttf).`
    );
  }

  cachedFonts = [
    { name: "Radikal", data: fs.readFileSync(regularPath), weight: 400, style: "normal" },
    { name: "Radikal", data: fs.readFileSync(boldPath), weight: 700, style: "normal" },
  ];
  return cachedFonts;
}

// Rendert JSX → SVG (via satori) → PNG-Bytes (via resvg).
// Compliance: satori macht KEIN dynamisches Layout — der gerenderte Output
// ist deterministisch fuer denselben Input.
export async function renderToPng(
  node: ReactElement,
  opts: RenderToPngOptions
): Promise<Buffer> {
  const fonts = loadFonts(opts.brandAssetsDir);

  const svg = await satori(node, {
    width: opts.width,
    height: opts.height,
    fonts,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: opts.width },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}
