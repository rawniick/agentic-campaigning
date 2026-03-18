"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CampaignStatus } from "@/types/database";

const STATUS_OPTIONS: { value: CampaignStatus | "all"; label: string }[] = [
  { value: "all", label: "Alle Status" },
  { value: "draft", label: "Entwurf" },
  { value: "input_complete", label: "Input komplett" },
  { value: "strategy_proposed", label: "Strategie vorgeschlagen" },
  { value: "strategy_selected", label: "Strategie gewaehlt" },
  { value: "concept_generated", label: "Konzept generiert" },
  { value: "concept_approved", label: "Konzept genehmigt" },
  { value: "translating", label: "Uebersetzung laeuft" },
  { value: "translations_ready", label: "Uebersetzungen fertig" },
  { value: "translations_approved", label: "Uebersetzungen genehmigt" },
  { value: "rendering_assets", label: "Assets rendern" },
  { value: "assets_ready", label: "Assets fertig" },
  { value: "assets_approved", label: "Assets genehmigt" },
  { value: "distributing", label: "Wird verteilt" },
  { value: "published", label: "Publiziert" },
  { value: "archived", label: "Archiviert" },
];

export function CampaignFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") ?? "all";
  const currentSearch = searchParams.get("q") ?? "";

  // Debounced Search: 300ms Verzoegerung
  const [searchValue, setSearchValue] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams("q", searchValue);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/campaigns?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Input
        placeholder="Kampagne suchen..."
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className="max-w-xs"
      />
      <Select
        value={currentStatus}
        onValueChange={(value) => updateParams("status", value)}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Status filtern" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
