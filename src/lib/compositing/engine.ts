// Server-Side Compositing Engine — Fallback wenn kein Canva
// Nutzt sharp fuer Bild-Manipulation + Text-Rendering

import sharp from "sharp";
import { getLayoutForFormat } from "./layouts";

export interface CompositingInput {
  heroImagePath?: string;      // URL oder lokaler Pfad zum Hero-Bild
  heroImageBuffer?: Buffer;    // Oder direkt als Buffer
  content: Record<string, string>;  // Text-Felder (claim, cta, hero_message, etc.)
  format: string;              // feed, story, banner, hero, newsletter, poster
  channel: string;             // social, crm, website, print
  brand: {
    primaryColor: string;      // Hex
    secondaryColor: string;    // Hex
    backgroundColor: string;   // Hex
    textColor: string;         // Hex
    logoUrl?: string;
  };
}

export interface CompositingResult {
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: string;
}

// Haupt-Compositing-Funktion
export async function compositeAsset(input: CompositingInput): Promise<CompositingResult> {
  const layout = getLayoutForFormat(input.channel, input.format);

  // 1. Basis-Canvas erstellen
  let canvas = sharp({
    create: {
      width: layout.width,
      height: layout.height,
      channels: 4,
      background: hexToRgba(input.brand.backgroundColor),
    },
  });

  const composites: sharp.OverlayOptions[] = [];

  // 2. Hero-Bild als Hintergrund (wenn vorhanden)
  if (input.heroImageBuffer || input.heroImagePath) {
    try {
      let heroBuffer: Buffer;
      if (input.heroImageBuffer) {
        heroBuffer = input.heroImageBuffer;
      } else if (input.heroImagePath) {
        if (input.heroImagePath.startsWith("http")) {
          const resp = await fetch(input.heroImagePath);
          heroBuffer = Buffer.from(await resp.arrayBuffer());
        } else {
          heroBuffer = await sharp(input.heroImagePath).toBuffer();
        }
      } else {
        heroBuffer = Buffer.alloc(0);
      }

      if (heroBuffer.length > 0) {
        const resizedHero = await sharp(heroBuffer)
          .resize(layout.heroZone?.width ?? layout.width, layout.heroZone?.height ?? layout.height, {
            fit: "cover",
            position: "center",
          })
          .toBuffer();

        composites.push({
          input: resizedHero,
          top: layout.heroZone?.top ?? 0,
          left: layout.heroZone?.left ?? 0,
        });
      }
    } catch (err) {
      console.warn("Hero-Bild Compositing fehlgeschlagen:", err);
    }
  }

  // 3. Farbiges Overlay fuer Text-Lesbarkeit
  if (layout.overlay) {
    const overlayBuffer = await sharp({
      create: {
        width: layout.overlay.width,
        height: layout.overlay.height,
        channels: 4,
        background: { ...hexToRgba(input.brand.primaryColor), alpha: layout.overlay.opacity },
      },
    }).png().toBuffer();

    composites.push({
      input: overlayBuffer,
      top: layout.overlay.top,
      left: layout.overlay.left,
    });
  }

  // 4. Text-Bloecke als SVG rendern
  for (const textZone of layout.textZones) {
    const text = input.content[textZone.field];
    if (!text) continue;

    const svgText = renderTextSvg(text, textZone, input.brand.textColor);
    const textBuffer = await sharp(Buffer.from(svgText)).png().toBuffer();

    composites.push({
      input: textBuffer,
      top: textZone.top,
      left: textZone.left,
    });
  }

  // 5. Compositing ausfuehren
  const result = await canvas
    .composite(composites)
    .png({ quality: 90 })
    .toBuffer();

  return {
    buffer: result,
    width: layout.width,
    height: layout.height,
    mimeType: "image/png",
  };
}

// SVG-Text rendern fuer sharp
function renderTextSvg(
  text: string,
  zone: { width: number; height: number; fontSize: number; fontWeight?: string; align?: string },
  color: string
): string {
  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const anchor = zone.align === "center" ? "middle" : zone.align === "right" ? "end" : "start";
  const x = zone.align === "center" ? zone.width / 2 : zone.align === "right" ? zone.width - 10 : 10;

  return `<svg width="${zone.width}" height="${zone.height}" xmlns="http://www.w3.org/2000/svg">
    <text x="${x}" y="${zone.fontSize + 5}"
      font-family="Arial, Helvetica, sans-serif"
      font-size="${zone.fontSize}"
      font-weight="${zone.fontWeight ?? 'normal'}"
      fill="${color}"
      text-anchor="${anchor}">
      ${escapedText}
    </text>
  </svg>`;
}

function hexToRgba(hex: string): { r: number; g: number; b: number; alpha: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
    alpha: 1,
  };
}
