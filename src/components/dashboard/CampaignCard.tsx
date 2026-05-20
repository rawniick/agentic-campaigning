import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import type { Campaign } from "@/types/database";
import { Calendar, Tag, Globe } from "lucide-react";

interface CampaignCardProps {
  campaign: Campaign;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  return (
    <Link href={`/campaigns/${campaign.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{campaign.promo_id}</p>
              <CardTitle className="mt-1 text-base">{campaign.product_name}</CardTitle>
            </div>
            <StatusBadge status={campaign.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Tag className="h-3.5 w-3.5" />
            <span>{campaign.brand} &middot; {campaign.campaign_type}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground">
              CHF {Number(campaign.price_new).toFixed(2)}
            </span>
            <span>{campaign.price_suffix}</span>
            {campaign.price_old && (
              <span className="text-xs line-through">
                CHF {Number(campaign.price_old).toFixed(2)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5" />
            <span>{campaign.languages.join(", ").toUpperCase()}</span>
          </div>
          {campaign.start_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              <span>{campaign.start_date} – {campaign.end_date}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-1 pt-1">
            {campaign.channels.map((ch) => (
              <span key={ch} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {ch}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
