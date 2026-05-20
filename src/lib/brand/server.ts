import { getDb } from "../db/server";
import { loadBrand, type BrandConfig } from "./loadBrand";

let cached: BrandConfig | null = null;

// Server-Helper: laedt die aktive Brand aus DB + Filesystem.
// V1 single-brand via ACE_ACTIVE_BRAND env, default 'wingo'.
export async function getActiveBrandConfig(): Promise<BrandConfig> {
  if (cached) return cached;
  const slug = process.env.ACE_ACTIVE_BRAND ?? "wingo";
  cached = await loadBrand(getDb(), slug);
  return cached;
}

// Fuer Hot-Reload / Tests
export function clearBrandConfigCache(): void {
  cached = null;
}
