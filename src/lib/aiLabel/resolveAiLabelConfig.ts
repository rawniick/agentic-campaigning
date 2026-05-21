import type { Db } from "../db/types";
import { getAiLabelAsset } from "../db/queries/ai-label";
import type { FormatSpec, AiLabelPosition } from "../db/queries/format-specs";
import type { AiLabelConfig } from "../render/AiLabelOverlay";

// Liefert die effektive AI-Label-Konfiguration fuer ein konkretes Format
// einer Brand. Fallback-Chain:
//   1. Brand hat kein Asset registriert  → null
//   2. format_specs.ai_label_position vorhanden → format-spezifische Position
//   3. sonst → ai_label_assets.default_position der Brand
export async function resolveAiLabelConfig(
  db: Db,
  brandId: string,
  formatSpec: FormatSpec
): Promise<AiLabelConfig | null> {
  const asset = await getAiLabelAsset(db, brandId);
  if (!asset) return null;

  const position =
    (formatSpec.ai_label_position as AiLabelPosition | null) ??
    asset.default_position;

  return {
    src: asset.storage_url,
    position,
  };
}
