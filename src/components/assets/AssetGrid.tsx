"use client";

import { useState, useMemo } from "react";
import { AssetPreview } from "./AssetPreview";
import { Badge } from "@/components/ui/badge";
import type { Asset } from "@/types/database";

const CHANNEL_LABELS: Record<string, string> = {
  social: "Social",
  crm: "CRM",
  website: "Website",
  sea: "SEA",
  print: "Print",
};

const LANGUAGE_LABELS: Record<string, string> = {
  de: "DE",
  fr: "FR",
  it: "IT",
  en: "EN",
};

interface AssetGridProps {
  assets: Asset[];
  onRefresh?: () => void;
}

export function AssetGrid({ assets, onRefresh }: AssetGridProps) {
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);

  // Verfuegbare Kanaele und Sprachen aus Assets ableiten
  const channels = useMemo(
    () => [...new Set(assets.map((a) => a.channel))],
    [assets]
  );
  const languages = useMemo(
    () => [...new Set(assets.map((a) => a.language))],
    [assets]
  );

  // Gefilterte Assets
  const filtered = useMemo(() => {
    let result = assets;
    if (selectedChannel) {
      result = result.filter((a) => a.channel === selectedChannel);
    }
    if (selectedLanguage) {
      result = result.filter((a) => a.language === selectedLanguage);
    }
    return result;
  }, [assets, selectedChannel, selectedLanguage]);

  if (assets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine Assets generiert.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter-Bar */}
      <div className="flex flex-wrap gap-4">
        {/* Kanal-Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Kanal:</span>
          <div className="flex gap-1">
            <FilterBadge
              label="Alle"
              active={selectedChannel === null}
              onClick={() => setSelectedChannel(null)}
            />
            {channels.map((ch) => (
              <FilterBadge
                key={ch}
                label={CHANNEL_LABELS[ch] ?? ch}
                active={selectedChannel === ch}
                onClick={() => setSelectedChannel(ch)}
              />
            ))}
          </div>
        </div>

        {/* Sprach-Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sprache:</span>
          <div className="flex gap-1">
            <FilterBadge
              label="Alle"
              active={selectedLanguage === null}
              onClick={() => setSelectedLanguage(null)}
            />
            {languages.map((lang) => (
              <FilterBadge
                key={lang}
                label={LANGUAGE_LABELS[lang] ?? lang.toUpperCase()}
                active={selectedLanguage === lang}
                onClick={() => setSelectedLanguage(lang)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Anzahl */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} von {assets.length} Assets
      </p>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filtered.map((asset) => (
          <AssetPreview key={asset.id} asset={asset} onRegenerate={() => onRefresh?.()} />
        ))}
      </div>
    </div>
  );
}

// Filter-Badge Hilfskomponente
function FilterBadge({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Badge
      variant={active ? "default" : "outline"}
      className="cursor-pointer"
      onClick={onClick}
    >
      {label}
    </Badge>
  );
}
