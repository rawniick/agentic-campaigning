import { notFound } from "next/navigation";
import { getCampaignById } from "@/lib/db/queries/campaigns";
import { getConceptsByCampaign } from "@/lib/db/queries/concepts";
import { getTranslationsByCampaign } from "@/lib/db/queries/translations";
import { getApprovalsByCampaign } from "@/lib/db/queries/approvals";
import { getFeedbackMessages } from "@/lib/db/queries/feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { GenerateActions } from "@/components/dashboard/GenerateActions";
import { StrategySelector } from "@/components/briefing/StrategySelector";
import { ConceptCard } from "@/components/briefing/ConceptCard";
import { DraftConceptCard } from "@/components/briefing/DraftConceptCard";
import { ChannelPreview } from "@/components/briefing/ChannelPreview";
import { TranslationView } from "@/components/briefing/TranslationView";
import { FeedbackChat } from "@/components/feedback/FeedbackChat";
import { ApprovalFlow } from "@/components/approval/ApprovalFlow";
import { ApprovalButton } from "@/components/approval/ApprovalButton";
import { AssetGrid } from "@/components/assets/AssetGrid";
import { ExportPanel } from "@/components/export/ExportPanel";
import { Separator } from "@/components/ui/separator";
import type { ApprovalStage } from "@/types/database";
import Link from "next/link";
import type { Campaign } from "@/types/database";
import { getAssetsByCampaign } from "@/lib/db/queries/assets";
import { getDistributionsByCampaign } from "@/lib/db/queries/distributions";

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

  const [concepts, translations, approvals, assets, distributions] = await Promise.all([
    getConceptsByCampaign(id).catch(() => []),
    getTranslationsByCampaign(id).catch(() => []),
    getApprovalsByCampaign(id).catch(() => []),
    getAssetsByCampaign(id).catch(() => []),
    getDistributionsByCampaign(id).catch(() => []),
  ]);

  const isV2 = campaign.flow_version === 2;

  // v2: Konzepte nach Typ filtern
  const draftConcepts = concepts.filter((c) => c.concept_type === "draft");
  const detailConcepts = concepts.filter((c) => c.concept_type === "detail");
  const legacyConcepts = concepts.filter((c) => c.concept_type === "legacy");

  const selectedConcept = isV2
    ? detailConcepts.find((c) => c.is_selected) ?? draftConcepts.find((c) => c.is_selected)
    : concepts.find((c) => c.is_selected);

  const sourceClaims = selectedConcept?.claims?.variants ?? [];
  const sourceHeroMessage = selectedConcept?.hero_message ?? undefined;

  // v2 Feedback laden
  let draftFeedback: Awaited<ReturnType<typeof getFeedbackMessages>> = [];
  let detailFeedback: Awaited<ReturnType<typeof getFeedbackMessages>> = [];
  if (isV2) {
    [draftFeedback, detailFeedback] = await Promise.all([
      getFeedbackMessages(id, "draft_concept").catch(() => []),
      getFeedbackMessages(id, "detail_concept").catch(() => []),
    ]);
  }

  // Bestimme aktuelle Approval-Stage
  function getCurrentApprovalStage(): ApprovalStage | null {
    if (isV2) {
      if (["draft_concept_generated", "draft_concept_feedback"].includes(campaign.status)) return "draft_concept";
      if (["detail_concept_generated", "detail_concept_feedback"].includes(campaign.status)) return "detail_concept";
    }
    if (campaign.status === "concept_generated") return "concept";
    if (campaign.status === "translations_ready") return "translations";
    if (campaign.status === "assets_ready") return "assets";
    return null;
  }

  const currentApprovalStage = getCurrentApprovalStage();
  const hasPendingApproval = currentApprovalStage !== null &&
    approvals.some((a) => a.stage === currentApprovalStage && a.status === "pending");

  // v2: Aktives Draft-Konzept fuer Feedback-Chat
  const activeDraftConcept = draftConcepts.sort((a, b) => b.iteration - a.iteration)[0];
  const activeDetailConcept = detailConcepts.sort((a, b) => b.iteration - a.iteration)[0];

  return (
    <div className="space-y-6">
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
            {isV2 && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                v2 Flow
              </span>
            )}
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

      {/* Approval Flow */}
      <ApprovalFlow
        approvals={approvals}
        currentStatus={campaign.status}
        flowVersion={campaign.flow_version}
      />

      {/* Approval-Buttons (nur v1, v2 nutzt FeedbackChat) */}
      {!isV2 && currentApprovalStage && hasPendingApproval && (
        <ApprovalButton
          campaignId={id}
          stage={currentApprovalStage}
          hasPendingApproval={hasPendingApproval}
        />
      )}

      {/* Generate-Actions */}
      <GenerateActions
        campaignId={id}
        status={campaign.status}
        selectedStrategyIndex={campaign.selected_strategy_index}
        flowVersion={campaign.flow_version}
      />

      <Separator />

      {/* Tabs: v1 vs v2 */}
      {isV2 ? (
        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Uebersicht</TabsTrigger>
            <TabsTrigger value="eingabe">Eingabe</TabsTrigger>
            <TabsTrigger value="strategy">Strategie</TabsTrigger>
            <TabsTrigger value="grobkonzept">Grobkonzept</TabsTrigger>
            <TabsTrigger value="detailkonzept">Detailkonzept</TabsTrigger>
            <TabsTrigger value="translations">Uebersetzungen</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>

          {/* Uebersicht */}
          <TabsContent value="overview" className="space-y-4">
            <OverviewTab campaign={campaign} id={id} />
          </TabsContent>

          {/* Eingabe */}
          <TabsContent value="eingabe" className="space-y-4">
            {["draft", "input_complete", "input_review"].includes(campaign.status) ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Eingabe noch nicht bestaetigt.
                </p>
                <Link
                  href={`/campaigns/${id}/review`}
                  className="text-sm text-primary hover:underline"
                >
                  Eingabe pruefen und bestaetigen →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-green-600">
                Eingabe bestaetigt am{" "}
                {campaign.input_confirmed_at
                  ? new Date(campaign.input_confirmed_at).toLocaleString("de-CH")
                  : "–"}
              </p>
            )}
          </TabsContent>

          {/* Strategie */}
          <TabsContent value="strategy">
            {campaign.strategy_options && campaign.strategy_options.length > 0 ? (
              <StrategySelector
                campaignId={id}
                options={campaign.strategy_options}
                selectedIndex={campaign.selected_strategy_index}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine Strategie generiert. Bestaetige zuerst die Eingabe.
              </p>
            )}
          </TabsContent>

          {/* Grobkonzept */}
          <TabsContent value="grobkonzept" className="space-y-4">
            {activeDraftConcept ? (
              <>
                <DraftConceptCard concept={activeDraftConcept} />
                {/* Feedback-Chat fuer Grobkonzept */}
                {["draft_concept_generated", "draft_concept_feedback"].includes(campaign.status) && (
                  <Card>
                    <CardContent className="pt-6">
                      <FeedbackChat
                        campaignId={id}
                        phase="draft_concept"
                        currentConcept={activeDraftConcept}
                        initialMessages={draftFeedback}
                      />
                    </CardContent>
                  </Card>
                )}
                {[
                  "draft_concept_approved", "detail_concept_generated", "detail_concept_feedback",
                  "detail_concept_approved", "concept_approved", "translating", "translations_ready",
                  "translations_approved", "rendering_assets", "assets_ready", "assets_approved",
                  "distributing", "published",
                ].includes(campaign.status) && (
                  <p className="text-sm text-green-600">Grobkonzept freigegeben</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch kein Grobkonzept generiert. Waehle zuerst eine Strategie.
              </p>
            )}
          </TabsContent>

          {/* Detailkonzept */}
          <TabsContent value="detailkonzept" className="space-y-4">
            {activeDetailConcept ? (
              <>
                <ConceptCard concept={activeDetailConcept} />
                {activeDetailConcept.channel_adaptations && (
                  <ChannelPreview adaptations={activeDetailConcept.channel_adaptations} />
                )}
                {/* Feedback-Chat fuer Detailkonzept */}
                {["detail_concept_generated", "detail_concept_feedback"].includes(campaign.status) && (
                  <Card>
                    <CardContent className="pt-6">
                      <FeedbackChat
                        campaignId={id}
                        phase="detail_concept"
                        currentConcept={activeDetailConcept}
                        initialMessages={detailFeedback}
                      />
                    </CardContent>
                  </Card>
                )}
                {[
                  "detail_concept_approved", "concept_approved", "translating", "translations_ready",
                  "translations_approved", "rendering_assets", "assets_ready", "assets_approved",
                  "distributing", "published",
                ].includes(campaign.status) && (
                  <p className="text-sm text-green-600">Detailkonzept freigegeben</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch kein Detailkonzept generiert. Grobkonzept muss zuerst freigegeben werden.
              </p>
            )}
          </TabsContent>

          {/* Uebersetzungen */}
          <TabsContent value="translations">
            <TranslationView
              translations={translations}
              sourceClaims={sourceClaims}
              sourceHeroMessage={sourceHeroMessage}
            />
          </TabsContent>

          {/* Content */}
          <TabsContent value="content" className="space-y-4">
            {assets.length > 0 ? (
              <>
                <AssetGrid assets={assets} />
                <div className="text-sm">
                  <Link href={`/campaigns/${id}/content`} className="text-muted-foreground hover:underline">
                    Vollstaendige Content-Ansicht
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine Assets generiert.
              </p>
            )}
          </TabsContent>

          {/* Export */}
          <TabsContent value="export" className="space-y-4">
            <ExportPanel campaignId={id} status={campaign.status} distributions={distributions} />
          </TabsContent>
        </Tabs>
      ) : (
        /* v1 Tabs — unveraendert */
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Uebersicht</TabsTrigger>
            <TabsTrigger value="strategy">Strategie</TabsTrigger>
            <TabsTrigger value="concept">Konzept</TabsTrigger>
            <TabsTrigger value="translations">Uebersetzungen</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <OverviewTab campaign={campaign} id={id} />
          </TabsContent>

          <TabsContent value="strategy">
            {campaign.strategy_options && campaign.strategy_options.length > 0 ? (
              <StrategySelector
                campaignId={id}
                options={campaign.strategy_options}
                selectedIndex={campaign.selected_strategy_index}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine Strategie generiert. Klicke &quot;Strategie generieren&quot; um zu starten.
              </p>
            )}
          </TabsContent>

          <TabsContent value="concept" className="space-y-4">
            {legacyConcepts.length > 0 || concepts.length > 0 ? (
              <>
                {(legacyConcepts.length > 0 ? legacyConcepts : concepts).map((concept) => (
                  <div key={concept.id} className="space-y-4">
                    <ConceptCard concept={concept} />
                    {concept.channel_adaptations && (
                      <ChannelPreview adaptations={concept.channel_adaptations} />
                    )}
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch kein Konzept generiert. Waehle zuerst eine Strategie aus.
              </p>
            )}
          </TabsContent>

          <TabsContent value="translations">
            <TranslationView
              translations={translations}
              sourceClaims={sourceClaims}
              sourceHeroMessage={sourceHeroMessage}
            />
          </TabsContent>

          <TabsContent value="content" className="space-y-4">
            {assets.length > 0 ? (
              <>
                <AssetGrid assets={assets} />
                <div className="text-sm">
                  <Link href={`/campaigns/${id}/content`} className="text-muted-foreground hover:underline">
                    Vollstaendige Content-Ansicht
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine Assets generiert. Genehmige zuerst die Uebersetzungen.
              </p>
            )}
          </TabsContent>

          <TabsContent value="export" className="space-y-4">
            <ExportPanel campaignId={id} status={campaign.status} distributions={distributions} />
            <div className="text-sm">
              <Link href={`/campaigns/${id}/export`} className="text-muted-foreground hover:underline">
                Vollstaendige Export-Ansicht
              </Link>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// Uebersicht-Tab (geteilt zwischen v1 und v2)
function OverviewTab({ campaign, id }: { campaign: Campaign; id: string }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Kampagnen-Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Zeitraum" value={`${campaign.start_date ?? "–"} bis ${campaign.end_date ?? "–"}`} />
            {campaign.produkt_kategorie && <Row label="Kategorie" value={campaign.produkt_kategorie} />}
            <Row label="Zielgruppen" value={campaign.target_audiences.join(", ") || "–"} />
            {campaign.zielgebiet && <Row label="Zielgebiet" value={campaign.zielgebiet} />}
            <Row label="Claim-Richtung" value={campaign.claim_direction ?? "auto"} />
            <Row label="Kanaele" value={campaign.channels.join(", ")} />
            <Row label="Sprachen" value={campaign.languages.join(", ").toUpperCase()} />
            {campaign.budget && <Row label="Budget" value={campaign.budget} />}
            {campaign.order_ziel && <Row label="Order-Ziel" value={campaign.order_ziel} />}
            {campaign.auftraggeber && <Row label="Auftraggeber" value={campaign.auftraggeber} />}
            {campaign.freigabe && <Row label="Freigabe" value={campaign.freigabe} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="5G Badge" value={campaign.five_g_badge ? "Ja" : "Nein"} />
            <Row label="Swisscom Netz" value={campaign.swisscom_netz_hinweis ? "Ja" : "Nein"} />
            <Row label="Disclaimer" value={campaign.disclaimer_text ?? "–"} />
            <Row label="Legal Review" value={campaign.legal_review_required ? "Erforderlich" : "Nein"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Kosten-Tracking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Tokens verbraucht" value={Number(campaign.total_tokens_used).toLocaleString()} />
            <Row label="API-Kosten" value={`CHF ${Number(campaign.total_api_cost_chf).toFixed(4)}`} />
          </CardContent>
        </Card>
      </div>
      <div className="text-sm text-muted-foreground">
        <Link href={`/campaigns/${id}/briefing`} className="hover:underline">
          Briefing-Ansicht (druckfreundlich)
        </Link>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
