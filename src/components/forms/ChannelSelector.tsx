"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Monitor, Search, Users, Mail, MapPin, ShoppingBag, Printer } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { PromoInput } from "@/lib/schemas/promo-input";

interface ChannelSelectorProps {
  form: UseFormReturn<PromoInput>;
}

interface ChannelDef {
  key: keyof PromoInput["vermarktung"]["massnahmen"];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  options: { value: string; label: string }[];
  optionKey: "formats" | "platforms" | "types";
}

const CHANNELS: ChannelDef[] = [
  {
    key: "digital",
    label: "Digital",
    icon: Monitor,
    optionKey: "formats",
    options: [
      { value: "display_banner", label: "Display Banner" },
      { value: "social_feed", label: "Social Feed" },
      { value: "social_story", label: "Social Story" },
      { value: "newsletter_banner", label: "Newsletter Banner" },
      { value: "website_teaser", label: "Website Teaser" },
      { value: "website_hero", label: "Website Hero" },
    ],
  },
  {
    key: "sea",
    label: "SEA",
    icon: Search,
    optionKey: "platforms",
    options: [
      { value: "google", label: "Google Ads" },
      { value: "bing", label: "Microsoft Ads" },
    ],
  },
  {
    key: "social_organic",
    label: "Social Organic",
    icon: Users,
    optionKey: "platforms",
    options: [
      { value: "instagram", label: "Instagram" },
      { value: "facebook", label: "Facebook" },
      { value: "linkedin", label: "LinkedIn" },
      { value: "tiktok", label: "TikTok" },
    ],
  },
  {
    key: "crm",
    label: "CRM",
    icon: Mail,
    optionKey: "types",
    options: [
      { value: "newsletter", label: "Newsletter" },
      { value: "trigger_mail", label: "Trigger Mail" },
      { value: "push_notification", label: "Push Notification" },
    ],
  },
  {
    key: "print",
    label: "Print",
    icon: Printer,
    optionKey: "formats",
    options: [
      { value: "fust_inserat", label: "Fust Inserat" },
      { value: "id_inserat", label: "ID Inserat" },
      { value: "flyer", label: "Flyer" },
      { value: "zeitungsinserat", label: "Zeitungsinserat" },
    ],
  },
  {
    key: "ooh",
    label: "Out of Home",
    icon: MapPin,
    optionKey: "formats",
    options: [
      { value: "plakat_f4", label: "Plakat F4" },
      { value: "plakat_f12", label: "Plakat F12" },
      { value: "dooh_screen", label: "DOOH Screen" },
      { value: "citylights", label: "Citylights" },
    ],
  },
  {
    key: "pos",
    label: "POS",
    icon: ShoppingBag,
    optionKey: "formats",
    options: [
      { value: "pos_plakat", label: "POS Plakat" },
      { value: "digital_signage", label: "Digital Signage" },
      { value: "kassen_asset", label: "Kassen-Asset" },
      { value: "alarmcover", label: "Alarmcover" },
    ],
  },
];

export function ChannelSelector({ form }: ChannelSelectorProps) {
  const { watch, setValue } = form;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Massnahmen / Kanaele</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {CHANNELS.map((channel) => {
          const enabled = watch(`vermarktung.massnahmen.${channel.key}.enabled`);
          const Icon = channel.icon;

          return (
            <Card key={channel.key} className={enabled ? "border-primary" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <CardTitle className="text-sm">{channel.label}</CardTitle>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) =>
                      setValue(`vermarktung.massnahmen.${channel.key}.enabled`, checked)
                    }
                  />
                </div>
              </CardHeader>
              {enabled && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-2">
                    {channel.options.map((opt) => {
                      const channelData = watch(`vermarktung.massnahmen.${channel.key}`) as Record<string, unknown>;
                      const currentValues = (channelData?.[channel.optionKey] as string[]) || [];
                      const isChecked = currentValues.includes(opt.value);

                      return (
                        <div key={opt.value} className="flex items-center gap-2">
                          <Checkbox
                            id={`${channel.key}-${opt.value}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const updated = checked
                                ? [...currentValues, opt.value]
                                : currentValues.filter((v) => v !== opt.value);
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              setValue(`vermarktung.massnahmen.${channel.key}.${channel.optionKey}` as any, updated as any);
                            }}
                          />
                          <Label
                            htmlFor={`${channel.key}-${opt.value}`}
                            className="text-xs"
                          >
                            {opt.label}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
