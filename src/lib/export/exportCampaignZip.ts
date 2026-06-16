import type { Db } from "../db/types";
import type { FormatSpec } from "../db/queries/format-specs";
import { buildCampaignZipBuffer, type CampaignZipEntry } from "./buildZip";
import { buildAssetZipName } from "./zipNaming";

export type FetchAssetBytesFn = (storageUrl: string) => Promise<Buffer>;

// Kein einziges exportierbares (brand-konformes, gerendertes) Asset. Distinkt, damit
// die Route eine klare 422-Meldung liefern kann statt eines leeren 200-ZIP-Downloads.
export class EmptyExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmptyExportError";
  }
}

interface JoinedAssetRow {
  storage_url: string;
  language: string;
  brand_slug: string;
  campaign_art: string;
  format_id: string;
  format_code: string;
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

// Liefert ein ZIP-Buffer aller fuer die Kampagne gerenderten Assets.
// fetchBytes wird zur Laufzeit injiziert: in-memory in Tests, HTTPS fetch
// gegen Supabase Storage in Production.
export async function exportCampaignZip(
  db: Db,
  campaignId: string,
  fetchBytes: FetchAssetBytesFn
): Promise<Buffer> {
  const res = await db.query<JoinedAssetRow>(
    `SELECT
        a.storage_url, a.language,
        b.slug   AS brand_slug,
        c.art    AS campaign_art,
        fs.id    AS format_id, fs.code AS format_code,
        fs.channel_kategorie, fs.channel_plattform, fs.asset_media_art,
        fs.format_bezeichnung, fs.width, fs.height, fs.dpi,
        fs.max_filesize_kb, fs.filetype, fs.languages,
        fs.ai_label_position, fs.is_v1
       FROM assets a
       JOIN campaigns c     ON c.id = a.campaign_id
       JOIN brands b        ON b.id = c.brand_id
       JOIN format_specs fs ON fs.id = a.format_id
      WHERE a.campaign_id = $1
        -- Partial-success: fehlgeschlagene Renders sind als status='failed' mit
        -- storage_url IS NULL persistiert. Die nie mitzippen, sonst landet ein
        -- NULL-URL in fetch() und der ganze ZIP-Download crasht (Promise.all).
        AND a.status <> 'failed'
        AND a.storage_url IS NOT NULL
        -- KO-Gate: brand-nicht-konforme Assets (Platzhalter-Logo, falsche Dimensionen,
        -- Brand-Farbe fehlt) gehoeren NICHT in den finalen Export. conformity_pass=NULL
        -- (Legacy/ungeprueft) bleibt zugelassen; nur explizit false wird geblockt.
        AND a.conformity_pass IS NOT FALSE
      ORDER BY fs.format_bezeichnung, a.language`,
    [campaignId]
  );

  // Leeres Ergebnis NIE als (valides) leeres ZIP ausliefern — sonst laedt der
  // Marketer eine 0-Datei-ZIP ohne zu wissen warum. Haeufigster Fall: alle Assets
  // wegen fehlendem echten Logo brand-nicht-konform (conformity_pass=false).
  if (res.rows.length === 0) {
    throw new EmptyExportError(
      "Keine exportierbaren Assets — entweder noch nicht gerendert, oder alle brand-nicht-konform (z.B. Platzhalter-Logo). Siehe Gallery."
    );
  }

  const entries: CampaignZipEntry[] = await Promise.all(
    res.rows.map(async (row) => {
      const format: FormatSpec = {
        id: row.format_id,
        code: row.format_code,
        channel_kategorie: row.channel_kategorie,
        channel_plattform: row.channel_plattform,
        asset_media_art: row.asset_media_art,
        format_bezeichnung: row.format_bezeichnung,
        width: row.width,
        height: row.height,
        dpi: row.dpi,
        max_filesize_kb: row.max_filesize_kb,
        filetype: row.filetype,
        languages: row.languages,
        ai_label_position: row.ai_label_position,
        is_v1: row.is_v1,
      };
      const filename = buildAssetZipName({
        brandSlug: row.brand_slug,
        campaignArt: row.campaign_art,
        format,
        language: row.language,
      });
      const bytes = await fetchBytes(row.storage_url);
      return { filename, bytes };
    })
  );

  return buildCampaignZipBuffer(entries);
}
