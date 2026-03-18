import { Badge } from "@/components/ui/badge";
import {
  Image,
  Smartphone,
  Mail,
  Globe,
  Search,
  FileText,
  Monitor,
  Newspaper,
} from "lucide-react";
import type { ComponentType } from "react";

interface FormatConfig {
  label: string;
  icon: ComponentType<{ className?: string }>;
  variant: "default" | "secondary" | "outline";
}

const FORMAT_CONFIG: Record<string, FormatConfig> = {
  feed: { label: "Feed", icon: Image, variant: "default" },
  story: { label: "Story", icon: Smartphone, variant: "default" },
  newsletter: { label: "Newsletter", icon: Mail, variant: "secondary" },
  hero: { label: "Hero", icon: Monitor, variant: "secondary" },
  banner: { label: "Banner", icon: Globe, variant: "outline" },
  text_only: { label: "Text", icon: Search, variant: "outline" },
  poster: { label: "Poster", icon: FileText, variant: "outline" },
};

interface FormatBadgeProps {
  format: string;
  showIcon?: boolean;
}

export function FormatBadge({ format, showIcon = true }: FormatBadgeProps) {
  const config = FORMAT_CONFIG[format] ?? {
    label: format,
    icon: Newspaper,
    variant: "outline" as const,
  };
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
