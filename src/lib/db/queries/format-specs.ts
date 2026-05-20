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
