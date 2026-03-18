"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { StrategyOption } from "@/types/database";

interface StrategySelectorProps {
  campaignId: string;
  options: StrategyOption[];
  recommendedIndex?: number;
  selectedIndex?: number | null;
}

export function StrategySelector({
  campaignId,
  options,
  recommendedIndex = 0,
  selectedIndex,
}: StrategySelectorProps) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);

  async function handleSelect(index: number) {
    setSelecting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_strategy_index: index,
          status: "strategy_selected",
        }),
      });

      if (!res.ok) {
        toast.error("Strategie-Auswahl fehlgeschlagen");
        return;
      }

      toast.success(`${options[index].label} ausgewaehlt`);
      router.refresh();
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setSelecting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Strategische Richtungen</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {options.map((option, index) => {
          const isRecommended = index === recommendedIndex;
          const isSelected = index === selectedIndex;

          return (
            <Card
              key={index}
              className={isSelected ? "border-primary ring-2 ring-primary/20" : ""}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{option.label}</CardTitle>
                  <div className="flex gap-1">
                    {isRecommended && (
                      <Badge variant="secondary">Empfohlen</Badge>
                    )}
                    {isSelected && (
                      <Badge variant="default">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Gewaehlt
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{option.rationale}</p>

                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="font-medium">Richtung: {option.direction}</p>
                </div>

                {!isSelected && (
                  <Button
                    className="w-full"
                    variant={isRecommended ? "default" : "outline"}
                    onClick={() => handleSelect(index)}
                    disabled={selecting}
                  >
                    {selecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Diese Richtung waehlen
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
