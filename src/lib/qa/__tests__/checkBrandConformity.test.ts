// @vitest-environment node

import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { checkBrandConformity } from "../checkBrandConformity";

const PRIMARY = "#E61E2A"; // 230,30,42

async function solidPng(
  w: number,
  h: number,
  rgb: { r: number; g: number; b: number }
): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: rgb } })
    .png()
    .toBuffer();
}

describe("checkBrandConformity", () => {
  it("passes a conformant asset (real logo, right dimensions, brand color present)", async () => {
    const bytes = await solidPng(300, 600, { r: 230, g: 30, b: 42 });
    const res = await checkBrandConformity({
      pngBytes: bytes,
      expectedWidth: 300,
      expectedHeight: 600,
      brandPrimaryHex: PRIMARY,
      logoIsPlaceholder: false,
    });
    expect(res.pass).toBe(true);
    expect(res.checks.every((c) => c.pass)).toBe(true);
  });

  it("fails when the logo is a placeholder (KO criterion)", async () => {
    const bytes = await solidPng(300, 600, { r: 230, g: 30, b: 42 });
    const res = await checkBrandConformity({
      pngBytes: bytes,
      expectedWidth: 300,
      expectedHeight: 600,
      brandPrimaryHex: PRIMARY,
      logoIsPlaceholder: true,
    });
    expect(res.pass).toBe(false);
    expect(res.checks.find((c) => c.name === "logo_present")?.pass).toBe(false);
  });

  it("fails when rendered dimensions do not match the format spec", async () => {
    const bytes = await solidPng(301, 600, { r: 230, g: 30, b: 42 });
    const res = await checkBrandConformity({
      pngBytes: bytes,
      expectedWidth: 300,
      expectedHeight: 600,
      brandPrimaryHex: PRIMARY,
      logoIsPlaceholder: false,
    });
    expect(res.pass).toBe(false);
    expect(res.checks.find((c) => c.name === "dimensions")?.pass).toBe(false);
  });

  it("handles 3-digit short-form brand hex (#RGB) without NaN channels", async () => {
    // "#E12" → #EE1122 = (238, 17, 34); ein Asset in dieser Farbe muss bestehen.
    const bytes = await solidPng(300, 600, { r: 0xee, g: 0x11, b: 0x22 });
    const res = await checkBrandConformity({
      pngBytes: bytes,
      expectedWidth: 300,
      expectedHeight: 600,
      brandPrimaryHex: "#E12",
      logoIsPlaceholder: false,
    });
    expect(res.checks.find((c) => c.name === "brand_color")?.pass).toBe(true);
    expect(res.pass).toBe(true);
  });

  it("fails when the brand primary color is absent from the asset", async () => {
    const bytes = await solidPng(300, 600, { r: 239, g: 239, b: 239 }); // nur BG-Grau
    const res = await checkBrandConformity({
      pngBytes: bytes,
      expectedWidth: 300,
      expectedHeight: 600,
      brandPrimaryHex: PRIMARY,
      logoIsPlaceholder: false,
    });
    expect(res.pass).toBe(false);
    expect(res.checks.find((c) => c.name === "brand_color")?.pass).toBe(false);
  });
});
