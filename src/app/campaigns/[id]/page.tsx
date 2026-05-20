import { notFound } from "next/navigation";
import { getCampaignById } from "@/lib/db/queries/campaigns";
import { getSelectedConcept } from "@/lib/db/queries/concepts";
import { getTranslationsByCampaign } from "@/lib/db/queries/translations";
import { getAssetsByCampaign } from "@/lib/db/queries/assets";
import { getFeedbackMessages } from "@/lib/db/queries/feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { GenerateActions } from "@/components/dashboard/GenerateActions";
import { ConceptCard } from "@/components/briefing/ConceptCard";
import { ChannelPreview } from "@/components/briefing/ChannelPreview";
import { TranslationView } from "@/components/briefing/TranslationView";
import { FeedbackChat } from "@/components/feedback/FeedbackChat";
import { AssetGrid } from "@/components/assets/AssetGrid";
import { HeroImagePicker } from "@/components/assets/HeroImagePicker";
import type { Campaign } from "@/types/database";

interface CampaignDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { id } = await params;

  let campaign: Campaign;
  try {
    campaign = await getCampaignById(id);
  } catch {
    notFound();
  }

  const [concept, translations, assets, feedbackMessages] = await Promise.all([
    getSelectedConcept(id).catch(() => null),
    getTranslationsByCampaign(id).catch(() => []),
    getAssetsByCampaign(id).catch(() => []),
    getFeedbackMessages(id, "concept").catch(() => []),
  ]);

  const sourceClaims = concept?.claims?.variants ?? [];
  const sourceHeroMessage = concept?.hero_message ?? undefined;

  // Hero-Kandidaten vs regulaere Assets trennen
  const heroCandidates = assets.filter((a) => a.candidate_group_id !== null);
  const regularAssets = assets.filter((a) => a.candidate_group_id === null);

  // Sektionen progressive einblenden je nach Status
  const showConcept = !!concept;
  const showTranslations = ["translating", "translations_ready", "rendering_assets", "assets_ready", "assets_approved"].includes(campaign.status);
  const showAssets = ["rendering_assets", "assets_ready", "assets_approved"].includes(campaign.status);
  const showDownload = campaign.status === "assets_approved";
  const showFeedbackChat = ["concept_generated", "concept_feedback"].includes(campaign.status) && !!concept;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{campaign.promo_id}</p>
          <h1 className="text-3xl font-bold">{campaign.campaign_name ?? campaign.product_name}</h1>
          <p className="text-lg text-muted-foreground">{campaign.product_name}</p>
          <div className="mt-2 flex items-center gap-3">
            <StatusBadge status={campaign.status} />
            <span className="text-sm text-muted-foreground">
              {campaign.brand} &middot; {campaign.campaign_type}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">CHF {Number(campaign.price_new).toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">{campaign.price_suffix}</p>
          {campaign.price_old && (
            <p className="text-sm text-muted-foreground line-through">
              CHF {Number(campaign.price_old).toFixed(2)}
            </p>
          )}
        </div>
      </div>

      {/* Action-Buttons (V3 Flow) */}
      <GenerateActions campaignId={id} status={campaign.status} />

      <Separator />

      {/* === Eingabe (collapsible Summary) === */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eingabe</CardTitle>
        </CardHeader>
        <CardContent>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Briefing-Details anzeigen</summary>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Row label="Zeitraum" value={`${campaign.start_date ?? "–"} bis ${campaign.end_date ?? "–"}`} />
                {campaign.produkt_kategorie && <Row label="Kategorie" value={campaign.produkt_kategorie} />}
                <Row label="Zielgruppen" value={campaign.target_audiences.join(", ") || "–"} />
                {campaign.zielgebiet && <Row label="Zielgebiet" value={campaign.zielgebiet} />}
                <Row label="Claim-Richtung" value={campaign.claim_direction ?? "auto"} />
              </div>
              <div className="space-y-1">
                <Row label="Kanaele" value={campaign.channels.join(", ")} />
                <Row label="Sprachen" value={campaign.languages.join(", ").toUpperCase()} />
                {campaign.budget && <Row label="Budget" value={campaign.budget} />}
                <Row label="5G Badge" value={campaign.five_g_badge ? "Ja" : "Nein"} />
                <Row label="Disclaimer" value={campaign.disclaimer_text ? "Ja" : "Nein"} />
              </div>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* === Konzept (mit Feedback-Chat in Feedback-Phase) === */}
      {showConcept && concept && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Konzept (DE)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ConceptCard concept={concept} />
            {concept.channel_adaptations && (
              <ChannelPreview adaptations={concept.channel_adaptations} />
            )}
            {showFeedbackChat && (
              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <FeedbackChat
                    campaignId={id}
                    currentConcept={concept}
                    initialMessages={feedbackMessages}
                  />
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {/* === Uebersetzungen === */}
      {showTranslations && translations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uebersetzungen (DE / FR / IT / EN)</CardTitle>
          </CardHeader>
          <CardContent>
            <TranslationView
              translations={translations}
              sourceClaims={sourceClaims}
              sourceHeroMessage={sourceHeroMessage}
            />
          </CardContent>
        </Card>
      )}

      {/* === Assets (Hero-Picker inline + Grid) === */}
      {showAssets && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visual Assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {heroCandidates.length > 0 && (
              <HeroImagePicker
                campaignId={id}
                candidates={heroCandidates}
                selectedAssetId={campaign.hero_image_asset_id}
              />
            )}
            {regularAssets.length > 0 ? (
              <AssetGrid assets={regularAssets} />
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine Assets generiert.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* === Download === */}
      {showDownload && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Download</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Alle Assets + Briefing als ZIP herunterladen, danach selbststaendig in
              Meta / Google Ads / CRM hochladen.
            </p>
            <a
              href={`/api/export/download?campaignId=${id}`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              ZIP herunterladen
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
