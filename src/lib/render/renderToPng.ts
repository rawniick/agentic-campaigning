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

// Laedt Inter Regular + Bold aus /brand-assets/wingo/fonts/. Tests und Production
// teilen sich diesen Cache: der Renderer ist process-lokal, also einmal pro Worker.
function loadFonts(brandAssetsDir?: string): FontEntry[] {
  if (cachedFonts) return cachedFonts;

  const baseDir =
    brandAssetsDir ?? path.join(process.cwd(), "brand-assets", "wingo", "fonts");

  const regularPath = path.join(baseDir, "inter-regular.ttf");
  const boldPath = path.join(baseDir, "inter-bold.ttf");

  if (!fs.existsSync(regularPath) || !fs.existsSync(boldPath)) {
    throw new Error(
      `Required brand fonts missing. Expected ${regularPath} and ${boldPath}.`
    );
  }

  cachedFonts = [
    {
      name: "Inter",
      data: fs.readFileSync(regularPath),
      weight: 400,
      style: "normal",
    },
    {
      name: "Inter",
      data: fs.readFileSync(boldPath),
      weight: 700,
      style: "normal",
    },
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
