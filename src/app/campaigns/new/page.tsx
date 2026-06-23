import { getDb } from "@/lib/db/server";

export const dynamic = "force-dynamic";
// Submit ruft Claude (Copy-Gen) inkl. Retries — auf Vercel-Serverless mehr
// Zeit geben als der knappe Default, damit Retries nicht am Timeout sterben.
export const maxDuration = 60;

import { getActiveBrandConfig } from "@/lib/brand/server";
import { getProductsForBrand } from "@/lib/db/queries/products";
import { BriefForm } from "./BriefForm";

export default async function NewCampaignPage() {
  const brand = await getActiveBrandConfig();
  const products = await getProductsForBrand(getDb(), brand.brand.id);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-bold">Neue Kampagne</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Phase 1 Tracer-Bullet: Brief eingeben → eine Halfpage DE rendern.
      </p>
      <BriefForm products={products} />
    </div>
  );
}
