"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UseFormReturn } from "react-hook-form";
import type { PromoInput } from "@/lib/schemas/promo-input";

interface PricingInputProps {
  form: UseFormReturn<PromoInput>;
}

export function PricingInput({ form }: PricingInputProps) {
  const { register, watch, setValue, formState: { errors } } = form;

  const priceOld = watch("produktuebersicht.promoangebot.price_old");
  const priceNew = watch("produktuebersicht.promoangebot.price_new");

  // Live-Rabatt-Berechnung
  const discountPercent =
    priceOld && priceNew && priceOld > priceNew
      ? Math.round((1 - priceNew / priceOld) * 100)
      : null;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Promoangebot</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Alter Preis */}
        <div className="space-y-2">
          <Label htmlFor="price_old">Alter Preis (optional)</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">CHF</span>
            <Input
              id="price_old"
              type="number"
              step="0.05"
              placeholder="z.B. 29.95"
              {...register("produktuebersicht.promoangebot.price_old", { valueAsNumber: true })}
            />
          </div>
          {errors.produktuebersicht?.promoangebot?.price_old && (
            <p className="text-sm text-destructive">{errors.produktuebersicht.promoangebot.price_old.message}</p>
          )}
        </div>

        {/* Neuer Preis */}
        <div className="space-y-2">
          <Label htmlFor="price_new">Neuer Preis *</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">CHF</span>
            <Input
              id="price_new"
              type="number"
              step="0.05"
              placeholder="z.B. 19.95"
              {...register("produktuebersicht.promoangebot.price_new", { valueAsNumber: true })}
            />
          </div>
          {errors.produktuebersicht?.promoangebot?.price_new && (
            <p className="text-sm text-destructive">{errors.produktuebersicht.promoangebot.price_new.message}</p>
          )}
        </div>
      </div>

      {/* Live-Rabatt-Anzeige */}
      {discountPercent !== null && (
        <div className="rounded-md bg-muted p-3">
          <p className="text-sm font-medium">
            Rabatt: {discountPercent}% (CHF {priceOld!.toFixed(2)} → CHF {priceNew.toFixed(2)})
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Preis-Suffix */}
        <div className="space-y-2">
          <Label>Preis-Suffix</Label>
          <Select
            value={watch("produktuebersicht.promoangebot.price_suffix") || "none"}
            onValueChange={(val) => setValue("produktuebersicht.promoangebot.price_suffix", (val === "none" ? "" : val) as PromoInput["produktuebersicht"]["promoangebot"]["price_suffix"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="/Mt.">/Mt.</SelectItem>
              <SelectItem value="/Jahr">/Jahr</SelectItem>
              <SelectItem value="einmalig">einmalig</SelectItem>
              <SelectItem value="none">Kein Suffix</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Rabatt-Typ */}
        <div className="space-y-2">
          <Label>Rabatt-Typ</Label>
          <Select
            value={watch("produktuebersicht.promoangebot.discount_type") ?? "none"}
            onValueChange={(val) => setValue("produktuebersicht.promoangebot.discount_type", val as PromoInput["produktuebersicht"]["promoangebot"]["discount_type"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Kein Rabatt</SelectItem>
              <SelectItem value="percentage">Prozent</SelectItem>
              <SelectItem value="absolute">Absolut</SelectItem>
              <SelectItem value="special">Spezial</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Rabatt-Anzeige */}
        <div className="space-y-2">
          <Label htmlFor="discount_display">Rabatt-Anzeige (optional)</Label>
          <Input
            id="discount_display"
            placeholder="z.B. 50% Rabatt"
            {...register("produktuebersicht.promoangebot.discount_display")}
          />
        </div>

        {/* Dauer */}
        <div className="space-y-2">
          <Label>Rabatt-Dauer</Label>
          <Select
            value={watch("produktuebersicht.konditionen.duration") ?? ""}
            onValueChange={(val) => setValue("produktuebersicht.konditionen.duration", val as NonNullable<PromoInput["produktuebersicht"]["konditionen"]>["duration"])}
          >
            <SelectTrigger>
              <SelectValue placeholder="Waehlen..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lebenslang">Lebenslang</SelectItem>
              <SelectItem value="24_monate">24 Monate</SelectItem>
              <SelectItem value="12_monate">12 Monate</SelectItem>
              <SelectItem value="6_monate">6 Monate</SelectItem>
              <SelectItem value="3_monate">3 Monate</SelectItem>
              <SelectItem value="einmalig">Einmalig</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bedingungen */}
      <div className="space-y-2">
        <Label htmlFor="conditions">Bedingungen (optional)</Label>
        <Input
          id="conditions"
          placeholder="z.B. Nur bei Neuabschluss"
          {...register("produktuebersicht.konditionen.conditions")}
        />
      </div>
    </div>
  );
}
