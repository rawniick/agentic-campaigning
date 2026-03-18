import { notFound, redirect } from "next/navigation";
import { getCampaignById } from "@/lib/db/queries/campaigns";
import { mapCampaignToPromoInput } from "@/lib/mappers/campaign-to-promo-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputReviewForm } from "./InputReviewForm";
import type { Campaign } from "@/types/database";

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { id } = await params;

  let campaign: Campaign;
  try {
    campaign = await getCampaignById(id);
  } catch {
    notFound();
  }

  // Nur v2-Kampagnen im passenden Status
  if (campaign.flow_version !== 2) {
    redirect(`/campaigns/${id}`);
  }

  if (!["draft", "input_complete", "input_review"].includes(campaign.status)) {
    redirect(`/campaigns/${id}`);
  }

  // PromoInput rekonstruieren fuer editierbare Anzeige
  const promoInput = mapCampaignToPromoInput(campaign);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{campaign.promo_id}</p>
        <h1 className="text-3xl font-bold">Eingabe pruefen</h1>
        <p className="text-muted-foreground">
          Pruefe die Eingaben und bestaetige, bevor die Strategie generiert wird.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zusammenfassung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Row label="Kampagne" value={promoInput.kampagne.name} />
              <Row label="Zeitraum" value={`${promoInput.kampagne.datum_von} bis ${promoInput.kampagne.datum_bis}`} />
              <Row label="Marke" value={promoInput.kampagne.meta.brand} />
              <Row label="Typ" value={promoInput.kampagne.meta.campaign_type} />
              <Row label="Kategorie" value={promoInput.kampagne.produkt_kategorie} />
            </div>
            <div className="space-y-2">
              <Row label="Produkt" value={`${promoInput.produktuebersicht.produkt} (${promoInput.produktuebersicht.produkt_typ})`} />
              <Row label="Preis" value={`CHF ${promoInput.produktuebersicht.promoangebot.price_new}${promoInput.produktuebersicht.promoangebot.price_suffix}`} />
              {promoInput.produktuebersicht.promoangebot.price_old && (
                <Row label="Vorher" value={`CHF ${promoInput.produktuebersicht.promoangebot.price_old}${promoInput.produktuebersicht.promoangebot.price_suffix}`} />
              )}
              {promoInput.produktuebersicht.features.length > 0 && (
                <Row label="Features" value={promoInput.produktuebersicht.features.join(", ")} />
              )}
              <Row label="Claim-Richtung" value={promoInput.vermarktung.claim_direction} />
            </div>
          </div>

          {promoInput.vermarktung.hauptbotschaft && (
            <div className="pt-2 border-t">
              <span className="text-muted-foreground">Hauptbotschaft:</span>{" "}
              {promoInput.vermarktung.hauptbotschaft}
            </div>
          )}

          <div className="pt-2 border-t grid gap-2 md:grid-cols-2">
            <Row
              label="Kanaele"
              value={Object.entries(promoInput.vermarktung.massnahmen)
                .filter(([, v]) => v.enabled)
                .map(([k]) => k)
                .join(", ")}
            />
            <Row label="Sprachen" value={promoInput.vermarktung.languages.join(", ").toUpperCase()} />
            {promoInput.vermarktung.zielgruppe.length > 0 && (
              <Row label="Zielgruppen" value={promoInput.vermarktung.zielgruppe.join(", ")} />
            )}
            {promoInput.vermarktung.budget && <Row label="Budget" value={promoInput.vermarktung.budget} />}
          </div>

          {(promoInput.sonstiges.five_g_badge || promoInput.sonstiges.disclaimer_text) && (
            <div className="pt-2 border-t space-y-1">
              <span className="text-sm font-medium">Compliance</span>
              {promoInput.sonstiges.five_g_badge && <p>5G Badge: Ja</p>}
              {promoInput.sonstiges.swisscom_netz_hinweis && <p>Swisscom Netz Hinweis: Ja</p>}
              {promoInput.sonstiges.disclaimer_text && (
                <p className="text-muted-foreground">Disclaimer: {promoInput.sonstiges.disclaimer_text}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <InputReviewForm campaignId={id} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
