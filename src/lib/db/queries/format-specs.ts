import { z } from "zod";
import type { Db } from "../types";

export interface FormatSpec {
  id: string;
  code: string;
  channel_kategorie: string;
  channel_plattform: string;
  asset_media_art: string;
  format_bezeichnung: string;
  width: number;
  height: number;
  dpi: number;
  max_filesize_kb: number | null;
  filetype: string;
  languages: string[];
  ai_label_position: Record<string, unknown> | null;
  is_v1: boolean;
}

const AiLabelPositionSchema = z.object({
  anchor: z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]),
  offset: z.object({ x: z.number(), y: z.number() }),
  size: z.object({ w: z.number().positive(), h: z.number().positive() }),
});

export type AiLabelPosition = z.infer<typeof AiLabelPositionSchema>;

export async function getV1Formats(db: Db): Promise<FormatSpec[]> {
  const result = await db.query<FormatSpec>(
    `SELECT id, code, channel_kategorie, channel_plattform, asset_media_art,
            format_bezeichnung, width, height, dpi, max_filesize_kb, filetype,
            languages, ai_label_position, is_v1
       FROM format_specs
      WHERE is_v1 = true
        AND is_active = true
      ORDER BY channel_kategorie, format_bezeichnung`
  );
  return result.rows;
}

export async function getFormatSpecById(
  db: Db,
  id: string
): Promise<FormatSpec | null> {
  const result = await db.query<FormatSpec>(
    `SELECT id, code, channel_kategorie, channel_plattform, asset_media_art,
            format_bezeichnung, width, height, dpi, max_filesize_kb, filetype,
            languages, ai_label_position, is_v1
       FROM format_specs
      WHERE id = $1
      LIMIT 1`,
    [id]
  );
  return result.rows[0] ?? null;
}

// Setzt oder loescht die AI-Label-Position fuer ein Format. Null = global Default
// (aus /admin/ai-label) wird zur Render-Zeit gezogen.
export async function updateAiLabelPosition(
  db: Db,
  id: string,
  position: AiLabelPosition | null
): Promise<void> {
  if (position !== null) {
    AiLabelPositionSchema.parse(position);
  }
  await db.query(
    `UPDATE format_specs
        SET ai_label_position = $2::jsonb
      WHERE id = $1`,
    [id, position === null ? null : JSON.stringify(position)]
  );
}
