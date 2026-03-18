import { notFound } from "next/navigation";
import { getCampaignById } from "@/lib/db/queries/campaigns";
import { getConceptsByCampaign } from "@/lib/db/queries/concepts";
import { getTranslationsByCampaign } from "@/lib/db/queries/translations";
import { ConceptCard } from "@/components/briefing/ConceptCard";
import { ChannelPreview } from "@/components/briefing/ChannelPreview";
import { TranslationView } from "@/components/briefing/TranslationView";
import { Separator } from "@/components/ui/separator";
import type { Campaign } from "@/types/database";

interface BriefingPageProps {
  params: Promise<{ id: string }>;
}

export default async function BriefingPage({ params }: BriefingPageProps) {
  const { id } = await params;

  let campaign: Campaign;
  try {
    campaign = await getCampaignById(id);
  } catch {
    notFound();
  }

  const [concepts, translations] = await Promise.all([
    getConceptsByCampaign(id).catch(() => []),
    getTranslationsByCampaign(id).catch(() => []),
  ]);

  const selectedConcept = concepts.find((c) => c.is_selected);

  return (
    <div className="mx-auto max-w-4xl space-y-8 print:max-w-none print:p-0">
      {/* Header */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{campaign.promo_id}</p>
        <h1 className="text-3xl font-bold">Kampagnen-Briefing: {campaign.product_name}</h1>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{campaign.brand}</span>
          <span>{campaign.campaign_type}</span>
          <span>CHF {Number(campaign.price_new).toFixed(2)} {campaign.price_suffix}</span>
          {campaign.discount_display && <span>{campaign.discount_display}</span>}
        </div>
      </div>

      <Separator />

      {/* Konzept */}
      {selectedConcept && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Konzept</h2>
          <ConceptCard concept={selectedConcept} />

          {selectedConcept.channel_adaptations && (
            <>
              <h2 className="text-xl font-semibold">Kanaladaptionen</h2>
              <ChannelPreview adaptations={selectedConcept.channel_adaptations} />
            </>
          )}
        </div>
      )}

      <Separator />

      {/* Uebersetzungen */}
      {translations.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Uebersetzungen</h2>
          <TranslationView
            translations={translations}
            sourceClaims={selectedConcept?.claims?.variants}
            sourceHeroMessage={selectedConcept?.hero_message ?? undefined}
          />
        </div>
      )}

      {/* Compliance Info */}
      <Separator />
      <div className="space-y-2 text-sm">
        <h2 className="text-xl font-semibold">Compliance</h2>
        <ul className="list-disc pl-5 space-y-1">
          {campaign.five_g_badge && <li>5G Badge erforderlich</li>}
          {campaign.swisscom_netz_hinweis && <li>&quot;5G im Swisscom Netz&quot; Hinweis Pflicht</li>}
          {campaign.disclaimer_text && <li>Disclaimer: {campaign.disclaimer_text}</li>}
          {campaign.restrictions.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
