"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/server";
import { getActiveBrandConfig } from "@/lib/brand/server";
import { createProduct } from "@/lib/db/queries/products";

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
