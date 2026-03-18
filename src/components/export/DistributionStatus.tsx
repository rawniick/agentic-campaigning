import type { Distribution } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Globe, Target, HardDrive } from "lucide-react";

interface DistributionStatusProps {
  distributions: Distribution[];
}

const PLATFORM_CONFIG: Record<string, {
  label: string;
  icon: typeof Globe;
}> = {
  meta: { label: "Meta Ads", icon: Globe },
  google_ads: { label: "Google Ads", icon: Target },
  google_drive: { label: "Google Drive", icon: HardDrive },
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  uploading: "secondary",
  completed: "default",
  failed: "destructive",
  partial: "secondary",
};

export function DistributionStatus({ distributions }: DistributionStatusProps) {
  if (distributions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch nicht verteilt.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {distributions.map((dist) => {
        const config = PLATFORM_CONFIG[dist.platform];
        const Icon = config?.icon ?? Globe;
        const label = config?.label ?? dist.platform;

        return (
          <div key={dist.id} className="flex items-center justify-between rounded-md border p-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{label}</span>
            </div>
            <div className="flex items-center gap-2">
              {dist.success_count > 0 && (
                <span className="text-xs text-muted-foreground">
                  {dist.success_count}/{dist.asset_count}
                </span>
              )}
              <Badge variant={STATUS_VARIANT[dist.status] ?? "outline"}>
                {dist.status}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
