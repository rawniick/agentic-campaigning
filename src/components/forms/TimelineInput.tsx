"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { PromoInput } from "@/lib/schemas/promo-input";

interface TimelineInputProps {
  form: UseFormReturn<PromoInput>;
}

export function TimelineInput({ form }: TimelineInputProps) {
  const { watch, setValue, register } = form;
  const timeline = watch("timeline") || [];

  function addEntry() {
    setValue("timeline", [...timeline, { datum: "", beschreibung: "" }]);
  }

  function removeEntry(index: number) {
    setValue("timeline", timeline.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-lg font-medium">Timeline</Label>
        <Button type="button" variant="outline" size="sm" onClick={addEntry}>
          <Plus className="mr-1 h-4 w-4" />
          Eintrag hinzufuegen
        </Button>
      </div>

      {timeline.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Keine Timeline-Eintraege. Klicke &quot;Eintrag hinzufuegen&quot; um zu starten.
        </p>
      )}

      <div className="space-y-3">
        {timeline.map((_, index) => (
          <div key={index} className="flex items-start gap-3 rounded-md border p-3">
            <div className="space-y-1 flex-shrink-0">
              <Label className="text-xs">Datum</Label>
              <Input
                type="date"
                className="w-40"
                {...register(`timeline.${index}.datum`)}
              />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Beschreibung</Label>
              <Input
                placeholder="z.B. Briefing-Abgabe, Freigabe Konzept, Go-Live..."
                {...register(`timeline.${index}.beschreibung`)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-5 flex-shrink-0"
              onClick={() => removeEntry(index)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
