import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/server";
import { getCampaignById } from "@/lib/db/queries/campaigns";
import { getAssetsForCampaign } from "@/lib/db/queries/assets";
import { listHeroLibrary } from "@/lib/db/queries/hero-library";
import { GateView } from "./GateView";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;
  const db = getDb();

  const campaign = await getCampaignById(db, id);
  if (!campaign) notFound();

  const [assets, copyRes, heroRes, layoutRes, libraryEntries] = await Promise.all([
    getAssetsForCampaign(db, id),
    db.query<{
      headlines: string[];
      subline: string;
      cta_label: string;
      selected_headline_idx: number | null;
      is_approved: boolean;
    }>(
      `SELECT headlines, subline, cta_label, selected_headline_idx, is_approved
         FROM campaign_copy WHERE campaign_id = $1 AND language = 'de'`,
      [id]
    ),
    db.query<{ storage_url: string; is_approved: boolean; source: string }>(
      `SELECT storage_url, is_approved, source FROM campaign_hero WHERE campaign_id = $1`,
      [id]
    ),
    db.query<{ master_format: string; variant: string; is_approved: boolean }>(
      `SELECT master_format, variant, is_approved FROM campaign_layout WHERE campaign_id = $1`,
      [id]
    ),
    listHeroLibrary(db, campaign.brand_id),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold">{campaign.name}</h1>
      <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>
          Art: <strong>{campaign.art}</strong>
        </span>
        <span>
          Status: <strong>{campaign.status}</strong>
        </span>
        <span>
          {campaign.datum_von} → {campaign.datum_bis}
        </span>
        <span>
          {campaign.price_promo.toFixed(2)} CHF{campaign.price_suffix}
        </span>
      </div>

      <div className="mt-10">
        <GateView
          campaignId={id}
          status={campaign.status}
          copy={copyRes.rows[0] ?? null}
          hero={heroRes.rows[0] ?? null}
          layout={layoutRes.rows[0] ?? null}
          assets={assets.map((a) => ({
            id: a.id,
            storage_url: a.storage_url,
            language: a.language,
          }))}
          libraryEntries={libraryEntries.map((e) => ({
            id: e.id,
            name: e.name,
            storage_url: e.storage_url,
            categories: e.categories,
            lifestyles: e.lifestyles,
            seasons: e.seasons,
          }))}
        />
      </div>

      <details className="mt-10 rounded-md border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Briefing (JSON)
        </summary>
        <pre className="mt-3 max-h-96 overflow-auto text-xs">
          {JSON.stringify(campaign.brief, null, 2)}
        </pre>
      </details>
    </div>
  );
}
