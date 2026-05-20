import { describe, it, expect } from "vitest";
import { buildAssetZipName } from "../zipNaming";
import type { FormatSpec } from "../../db/queries/format-specs";

const halfpage: FormatSpec = {
  id: "00000000-0000-0000-0000-000000000001",
  code: "dv360_halfpage",
  channel_kategorie: "Display Standard",
  channel_plattform: "DV360",
  asset_media_art: "Display Banner",
  format_bezeichnung: "Halfpage Ad",
  width: 300,
  height: 600,
  dpi: 72,
  max_filesize_kb: 150,
  filetype: "JPEG",
  languages: ["de", "fr", "it"],
  ai_label_position: null,
  is_v1: true,
};

const pmax: FormatSpec = {
  ...halfpage,
  code: "google_pmax_static",
  format_bezeichnung: "Performance Max",
  width: 1200,
  height: 628,
  filetype: "JPEG",
};

const reddit: FormatSpec = {
  ...halfpage,
  code: "reddit_link_image",
  format_bezeichnung: "Reddit Link Ad Hauptbild",
  width: 1200,
  height: 628,
  filetype: "PNG",
};

describe("buildAssetZipName", () => {
  it("uses the brand_campaignart_bezeichnung_WxH_lang.ext schema", () => {
    expect(
      buildAssetZipName({
        brandSlug: "wingo",
        campaignArt: "flash_sale",
        format: halfpage,
        language: "de",
      })
    ).toBe("wingo_flashsale_halfpage_300x600_de.png");
  });

  it("slugifies a multi-word bezeichnung with underscores and lowercase", () => {
    expect(
      buildAssetZipName({
        brandSlug: "wingo",
        campaignArt: "flash_sale",
        format: pmax,
        language: "fr",
      })
    ).toBe("wingo_flashsale_performance_max_1200x628_fr.png");
  });

  it("always uses .png extension (Satori renders PNG bytes regardless of distribution filetype)", () => {
    expect(
      buildAssetZipName({
        brandSlug: "wingo",
        campaignArt: "flash_sale",
        format: reddit,
        language: "it",
      })
    ).toBe("wingo_flashsale_reddit_link_ad_hauptbild_1200x628_it.png");
  });
});
