import { PromoInputForm } from "@/components/forms/PromoInputForm";

export default function NewCampaignPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Neue Kampagne</h1>
        <p className="text-muted-foreground">
          Promo-Input erfassen und Kampagne erstellen.
        </p>
      </div>
      <PromoInputForm />
    </div>
  );
}
