import { describe, it } from "vitest";
import React from "react";
import fs from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";
import { renderToPng } from "../renderToPng";
import { loadBrandTokens } from "../../brand/loadTokens";
import { resolveLogoSrc, resolveStarBlobSrc } from "../../brand/resolveLogoSrc";
import { styleForArt, emphasisForArt } from "../../../templates/wingo/campaignStyle";
import type {
  TemplateComponent,
  TemplateProps,
} from "../../../templates/wingo/registry";
import { FlashSaleHalfpage } from "../../../templates/wingo/flash_sale/FlashSaleHalfpage";
import { FlashSaleRectangle } from "../../../templates/wingo/flash_sale/FlashSaleRectangle";
import { FlashSaleBillboard } from "../../../templates/wingo/flash_sale/FlashSaleBillboard";
import { FlashSaleMetaImage } from "../../../templates/wingo/flash_sale/FlashSaleMetaImage";
import { FlashSaleRicchi } from "../../../templates/wingo/flash_sale/FlashSaleRicchi";
import { FlashSaleWideboard } from "../../../templates/wingo/flash_sale/FlashSaleWideboard";
import { FlashSaleLandscape } from "../../../templates/wingo/flash_sale/FlashSaleLandscape";
import { FlashSaleSquare } from "../../../templates/wingo/flash_sale/FlashSaleSquare";

// Manuelle Render-Vorschau: rendert alle 8 Format-Layouts mit REALISTISCH langer
// DE-Copy + vollem Legal-Text (Umlaute, En-Dash, lange Subline/Disclaimer), um die
// Konformitaet/Robustheit der hartcodierten Layouts zu pruefen. Kein Assert — Output
// zur visuellen Review. Gated: nur mit PREVIEW=1.
//   PREVIEW=1 npx vitest run src/lib/render/__tests__/previewSamples.manual.test.ts
const RUN = process.env.PREVIEW === "1";

// Hybrid-Anatomie: kurze generierte Headline (Claim) + Doppelpreis + voller Legal.
const COPY = {
  headline: "Schweizer Netz — halber Preis",
  subline:
    "Unlimitiert telefonieren, surfen und streamen im besten Schweizer Netz — monatlich kündbar, ohne versteckte Gebühren.",
  pricePromo: "23.95",
  priceSuffix: "/Mt.",
  ctaLabel: "Hol's dir",
  disclaimer:
    "Aktion gültig bis 30.06.2026. Mindestvertragslaufzeit 24 Monate, danach CHF 50.–/Mt. Einmalige Aktivierungsgebühr CHF 59.–. · 5G im Swisscom Netz.",
  // V1.2 kanonische Anatomie
  productName: "Wingo Red Swiss",
  priceStandard: "50.–",
};

// Platzhalter für die freigestellte Person (echte Cut-out-PNGs folgen via Gate-2
// AI-Gen / Nick). Halbtransparente Silhouette, damit die Layout-Konformität
// beurteilbar ist ohne irreführendes "Bild im Bild".
function silhouettePlaceholder(): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420">` +
    `<g fill="rgba(15,15,15,0.20)">` +
    `<circle cx="150" cy="80" r="58"/>` +
    `<path d="M52 420 C52 250 95 168 150 168 C205 168 248 250 248 420 Z"/>` +
    `</g></svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 300 } })
    .render()
    .asPng();
  return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
}

const FORMATS: Array<{ code: string; w: number; h: number; C: TemplateComponent }> = [
  { code: "dv360_halfpage", w: 300, h: 600, C: FlashSaleHalfpage as TemplateComponent },
  { code: "dv360_rectangle", w: 300, h: 250, C: FlashSaleRectangle as TemplateComponent },
  { code: "dv360_billboard", w: 970, h: 250, C: FlashSaleBillboard as TemplateComponent },
  { code: "dv360_ricchi", w: 320, h: 416, C: FlashSaleRicchi as TemplateComponent },
  { code: "dv360_wideboard_xl", w: 994, h: 500, C: FlashSaleWideboard as TemplateComponent },
  { code: "meta_image", w: 1080, h: 1920, C: FlashSaleMetaImage as TemplateComponent },
  { code: "google_pmax_static", w: 1200, h: 628, C: FlashSaleLandscape as TemplateComponent },
  { code: "google_sea_ad_ext", w: 1200, h: 1200, C: FlashSaleSquare as TemplateComponent },
];

(RUN ? describe : describe.skip)("preview samples (long DE copy)", () => {
  it("rendert alle 8 Layout-Formate", async () => {
    const tokens = loadBrandTokens("wingo");
    const style = styleForArt("flash_sale", tokens);
    const emphasis = emphasisForArt("flash_sale");
    const logoSrc = resolveLogoSrc(tokens, "wingo", { variant: "white" });
    const priceBlobSrc = resolveStarBlobSrc("wingo") ?? undefined;

    const heroImageUrl = silhouettePlaceholder();

    const outDir = path.join(process.cwd(), "scripts", "preview");
    fs.mkdirSync(outDir, { recursive: true });

    for (const f of FORMATS) {
      const props: TemplateProps = {
        tokens,
        ...COPY,
        heroImageUrl,
        logoSrc,
        style,
        emphasis,
        priceBlobSrc,
        variant: "price_bottom",
      };
      const png = await renderToPng(React.createElement(f.C, props), {
        width: f.w,
        height: f.h,
      });
      fs.writeFileSync(path.join(outDir, `long_${f.code}.png`), png);
      // eslint-disable-next-line no-console
      console.log(`✓ ${f.code} (${f.w}x${f.h})`);
    }
  }, 120000);
});
