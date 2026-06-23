import fs from "fs";
import path from "path";
import { z } from "zod";

// 3- oder 6-stelliger Hex-Code mit fuehrendem #. Erzwingt Fail-Fast bei leeren Skeletons.
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const ColorTokenSchema = z.object({
  hex: z.string().regex(HEX_COLOR_REGEX, "muss ein gueltiger Hex-Farbcode sein"),
  name: z.string().optional(),
});

const FontSchema = z.object({
  family: z.string(),
  fallback: z.string().optional(),
});

const LogoVariantSchema = z.object({
  file: z.string(),
  min_size_px: z.number().optional(),
});

const BrandTokensSchema = z.object({
  colors: z.object({
    primary: ColorTokenSchema,
    // Optional: Fail-Fast nur auf primary. secondary/background_primary fliessen
    // in styleForArt (Template-Hintergrund + Text); fehlen sie, greifen Defaults.
    secondary: ColorTokenSchema.optional(),
    background_primary: ColorTokenSchema.optional(),
  }),
  typography: z.object({
    fonts: z.object({
      headline: FontSchema,
    }),
  }),
  logo: z.object({
    variants: z.record(z.string(), LogoVariantSchema),
    default_variant: z.string(),
  }),
});

export type BrandTokens = z.infer<typeof BrandTokensSchema>;

export interface LoadBrandTokensOptions {
  baseDir?: string;
}

export function loadBrandTokens(
  slug: string,
  opts: LoadBrandTokensOptions = {}
): BrandTokens {
  const baseDir = opts.baseDir ?? path.join(process.cwd(), "brand-assets");
  const tokensPath = path.join(baseDir, slug, "tokens.json");
  const raw = fs.readFileSync(tokensPath, "utf-8");
  const json = JSON.parse(raw);
  return BrandTokensSchema.parse(json);
}
