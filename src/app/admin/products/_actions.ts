"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/server";
import { getActiveBrandConfig } from "@/lib/brand/server";
import {
  createProduct,
  getProductsForBrand,
  updateProduct,
} from "@/lib/db/queries/products";
import { fetchWingoStandardPrice } from "@/lib/pricing/scrapeWingo";

const createSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["mobile", "internet", "tv"]),
  price_promo: z.coerce.number().min(0),
  price_standard: z.coerce.number().min(0).optional(),
  price_suffix: z.string().default("/Mt."),
  link: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  features: z
    .string()
    .optional()
    .transform((s) =>
      s
        ? s
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
        : []
    ),
  sku: z.string().optional(),
  network: z.enum(["5g_swisscom", "4g_swisscom", "other"]).optional(),
});

export async function createProductAction(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = createSchema.parse(raw);

  const brand = await getActiveBrandConfig();
  await createProduct(getDb(), {
    brand_id: brand.brand.id,
    ...parsed,
  });

  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export type PriceRefreshStatus =
  | "updated"
  | "unchanged"
  | "no_link"
  | "not_found"
  | "error";

export interface PriceRefreshRow {
  id: string;
  name: string;
  oldStandard: number | null;
  newStandard: number | null;
  status: PriceRefreshStatus;
  detail: string;
}

// Scrape-assistierte Standard-Preis-Aktualisierung: holt für jedes Produkt mit
// wingo.ch-Link den regulären Preis und schreibt ihn in price_standard. Gibt eine
// Diff-Tabelle zur manuellen Review zurück (Preise sind compliance-sensibel).
export async function refreshStandardPricesAction(): Promise<{
  rows: PriceRefreshRow[];
}> {
  const brand = await getActiveBrandConfig();
  const db = getDb();
  const products = await getProductsForBrand(db, brand.brand.id);

  const rows: PriceRefreshRow[] = [];
  for (const p of products) {
    if (!p.link) {
      rows.push({
        id: p.id,
        name: p.name,
        oldStandard: p.price_standard,
        newStandard: null,
        status: "no_link",
        detail: "Kein wingo.ch-Link hinterlegt",
      });
      continue;
    }

    const { standardPrice, detail } = await fetchWingoStandardPrice(
      p.link,
      p.price_promo
    );

    if (standardPrice === null) {
      rows.push({
        id: p.id,
        name: p.name,
        oldStandard: p.price_standard,
        newStandard: null,
        status: detail.startsWith("HTTP") || detail.startsWith("Fetch")
          ? "error"
          : "not_found",
        detail,
      });
      continue;
    }

    const unchanged =
      p.price_standard !== null &&
      Math.abs(p.price_standard - standardPrice) < 0.005;
    if (unchanged) {
      rows.push({
        id: p.id,
        name: p.name,
        oldStandard: p.price_standard,
        newStandard: standardPrice,
        status: "unchanged",
        detail: "unverändert",
      });
      continue;
    }

    await updateProduct(db, p.id, { price_standard: standardPrice });
    rows.push({
      id: p.id,
      name: p.name,
      oldStandard: p.price_standard,
      newStandard: standardPrice,
      status: "updated",
      detail: "aktualisiert",
    });
  }

  revalidatePath("/admin/products");
  return { rows };
}
