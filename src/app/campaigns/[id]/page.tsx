import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/server";

export const dynamic = "force-dynamic";

import { getCampaignById } from "@/lib/db/queries/campaigns";
import { getAssetsForCampaign } from "@/lib/db/queries/assets";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;
  const db = getDb();

  const campaign = await getCampaignById(db, id);
  if (!campaign) notFound();

  const assets = await getAssetsForCampaign(db, id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Zurück zum Dashboard
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

      <h2 className="mt-10 text-xl font-semibold">
        Assets ({assets.length})
      </h2>

      {assets.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Noch keine Assets gerendert.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {assets.map((a) => (
            <div
              key={a.id}
              className="rounded-md border bg-card p-4 shadow-sm"
            >
              <div className="mb-3 text-xs text-muted-foreground">
                {a.language.toUpperCase()} · {a.mime_type ?? "image/png"}
                {a.file_size_bytes
                  ? ` · ${Math.round(a.file_size_bytes / 1024)} KB`
                  : ""}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.storage_url}
                alt={`Asset ${a.id}`}
                className="w-full rounded border bg-white"
              />
              <div className="mt-3 flex gap-2">
                <a href={a.storage_url} download target="_blank" rel="noreferrer">
                  <Button size="sm">Download</Button>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

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
