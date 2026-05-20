"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { promoInputSchema, type PromoInput } from "@/lib/schemas/promo-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PricingInput } from "./PricingInput";
import { ChannelSelector } from "./ChannelSelector";
import { TimelineInput } from "./TimelineInput";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Send,
  Megaphone,
  Package,
  TrendingUp,
  Image,
  FileText,
  Calendar,
} from "lucide-react";

const STEPS = [
  { title: "Kampagne", description: "Grunddaten und Zeitraum", icon: Megaphone },
  { title: "Produktuebersicht", description: "Produkt, Preise und Konditionen", icon: Package },
  { title: "Vermarktung", description: "Botschaft, Zielgruppe, Kanaele", icon: TrendingUp },
  { title: "Sujets", description: "Visuelle Assets und Umsetzung", icon: Image },
  { title: "Sonstiges", description: "Personen, Compliance, Rechtliches", icon: FileText },
  { title: "Timeline & Review", description: "Meilensteine und Zusammenfassung", icon: Calendar },
];

export function PromoInputForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<PromoInput>({
    resolver: zodResolver(promoInputSchema) as any,
    defaultValues: {
      kampagne: {
        name: "",
        datum_von: "",
        datum_bis: "",
        produkt_kategorie: "mobile",
        id: "",
        krea_nr: "",
        meta: {
          brand: "",
          campaign_type: "standardpromo",
          status: "draft",
          priority: "normal",
        },
      },
      produktuebersicht: {
        produkt: "",
        produkt_typ: "abo",
        sku: "",
        link: "",
        promoangebot: {
          price_new: 0,
          currency: "CHF",
          price_suffix: "/Mt.",
        },
        konditionen: {},
        features: [],
      },
      vermarktung: {
        hauptbotschaft: "",
        nebenbotschaft: "",
        zielgruppe: [],
        zielgebiet: "",
        massnahmen: {
          print: { enabled: false, formats: [] },
          digital: { enabled: true, formats: [] },
          sea: { enabled: false, platforms: [] },
          social_organic: { enabled: false, platforms: [] },
          crm: { enabled: false, types: [] },
          ooh: { enabled: false, formats: [] },
          pos: { enabled: false, formats: [] },
        },
        budget: "",
        order_ziel: "",
        claim_direction: "auto",
        languages: ["de", "fr", "it"],
      },
      sujets: {
        ads: "",
        website_bilder: false,
        sonstiges_sujet: "",
        infos_umsetzung: "",
      },
      sonstiges: {
        umsetzung: "",
        auftraggeber: "",
        freigabe: "",
        at_nummer: "",
        bereich: "",
        disclaimer_required: true,
        five_g_badge: false,
        swisscom_netz_hinweis: true,
        legal_review_required: false,
        additional_legal: [],
      },
      timeline: [],
      restrictions: [],
    },
  });

  const { register, watch, setValue, formState: { errors }, trigger } = form;

  // Step-weise Validierung: Felder pro Schritt
  const STEP_FIELDS: (keyof PromoInput)[][] = [
    ["kampagne"],
    ["produktuebersicht"],
    ["vermarktung"],
    ["sujets"],
    ["sonstiges"],
    ["timeline"],
  ];

  async function goNext() {
    const fields = STEP_FIELDS[step];
    const valid = await trigger(fields);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function onSubmit(data: PromoInput) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error("Kampagne erstellen fehlgeschlagen", {
          description: result.error,
        });
        return;
      }

      toast.success("Kampagne erstellt");
      router.push(`/campaigns/${result.id}`);
    } catch {
      toast.error("Netzwerkfehler beim Erstellen der Kampagne");
    } finally {
      setSubmitting(false);
    }
  }

  // Feature-Liste als kommaseparierter String
  const [featureInput, setFeatureInput] = useState("");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Schritt {step + 1} von {STEPS.length}</span>
          <span>{STEPS[step].title}</span>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} />
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {(() => { const Icon = STEPS[step].icon; return <Icon className="h-5 w-5" />; })()}
              <CardTitle>{STEPS[step].title}</CardTitle>
            </div>
            <CardDescription>{STEPS[step].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* === Schritt 0: Kampagne === */}
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="campaign_name">Kampagnenname *</Label>
                  <Input
                    id="campaign_name"
                    placeholder="z.B. Fruehlingsangebot Mobile 2026"
                    {...register("kampagne.name")}
                  />
                  {errors.kampagne?.name && (
                    <p className="text-sm text-destructive">{errors.kampagne.name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="datum_von">Startdatum *</Label>
                    <Input
                      id="datum_von"
                      type="date"
                      {...register("kampagne.datum_von")}
                    />
                    {errors.kampagne?.datum_von && (
                      <p className="text-sm text-destructive">{errors.kampagne.datum_von.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="datum_bis">Enddatum *</Label>
                    <Input
                      id="datum_bis"
                      type="date"
                      {...register("kampagne.datum_bis")}
                    />
                    {errors.kampagne?.datum_bis && (
                      <p className="text-sm text-destructive">{errors.kampagne.datum_bis.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Produkt-Kategorie</Label>
                    <Select
                      value={watch("kampagne.produkt_kategorie")}
                      onValueChange={(val) => setValue("kampagne.produkt_kategorie", val as PromoInput["kampagne"]["produkt_kategorie"])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tv">TV</SelectItem>
                        <SelectItem value="internet">Internet</SelectItem>
                        <SelectItem value="mobile">Mobile</SelectItem>
                        <SelectItem value="bundle">Bundle</SelectItem>
                        <SelectItem value="other">Andere</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="promo_id">Promo-ID *</Label>
                    <Input
                      id="promo_id"
                      placeholder="ACE-2026-W10-001"
                      {...register("kampagne.id")}
                    />
                    {errors.kampagne?.id && (
                      <p className="text-sm text-destructive">{errors.kampagne.id.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="krea_nr">Krea-Nr. (optional)</Label>
                    <Input
                      id="krea_nr"
                      placeholder="z.B. K-2026-042"
                      {...register("kampagne.krea_nr")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Marke *</Label>
                    <Select
                      value={watch("kampagne.meta.brand")}
                      onValueChange={(val) => setValue("kampagne.meta.brand", val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Marke waehlen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="coop_mobile">Coop Mobile</SelectItem>
                        <SelectItem value="wingo">Wingo</SelectItem>
                        <SelectItem value="m_budget_mobile">M-Budget Mobile</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kampagnentyp *</Label>
                    <Select
                      value={watch("kampagne.meta.campaign_type")}
                      onValueChange={(val) => setValue("kampagne.meta.campaign_type", val as PromoInput["kampagne"]["meta"]["campaign_type"])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aktionswoche">Aktionswoche</SelectItem>
                        <SelectItem value="themenpromo">Themenpromo</SelectItem>
                        <SelectItem value="standardpromo">Standardpromo</SelectItem>
                        <SelectItem value="saisonpromo">Saisonpromo</SelectItem>
                        <SelectItem value="launch">Launch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Prioritaet</Label>
                    <Select
                      value={watch("kampagne.meta.priority")}
                      onValueChange={(val) => setValue("kampagne.meta.priority", val as PromoInput["kampagne"]["meta"]["priority"])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="express">Express</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* === Schritt 1: Produktuebersicht === */}
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="produkt">Produktname *</Label>
                  <Input
                    id="produkt"
                    placeholder="z.B. Basic Abo"
                    {...register("produktuebersicht.produkt")}
                  />
                  {errors.produktuebersicht?.produkt && (
                    <p className="text-sm text-destructive">{errors.produktuebersicht.produkt.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Produkttyp *</Label>
                    <Select
                      value={watch("produktuebersicht.produkt_typ")}
                      onValueChange={(val) => setValue("produktuebersicht.produkt_typ", val as PromoInput["produktuebersicht"]["produkt_typ"])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="abo">Abo</SelectItem>
                        <SelectItem value="prepaid">Prepaid</SelectItem>
                        <SelectItem value="hardware">Hardware</SelectItem>
                        <SelectItem value="bundle">Bundle</SelectItem>
                        <SelectItem value="option">Option</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Netzwerk</Label>
                    <Select
                      value={watch("produktuebersicht.network") ?? ""}
                      onValueChange={(val) => setValue("produktuebersicht.network", val as PromoInput["produktuebersicht"]["network"])}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Waehlen..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5g_swisscom">5G Swisscom</SelectItem>
                        <SelectItem value="4g_swisscom">4G Swisscom</SelectItem>
                        <SelectItem value="other">Andere</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product_link">Produkt-Link (optional)</Label>
                  <Input
                    id="product_link"
                    placeholder="https://..."
                    {...register("produktuebersicht.link")}
                  />
                </div>

                <PricingInput form={form} />

                <div className="space-y-2">
                  <Label>Features (kommasepariert)</Label>
                  <Input
                    placeholder="z.B. unlimitiert telefonieren, 10 GB Daten, EU-Roaming"
                    value={featureInput}
                    onChange={(e) => {
                      setFeatureInput(e.target.value);
                      const features = e.target.value
                        .split(",")
                        .map((f) => f.trim())
                        .filter(Boolean);
                      setValue("produktuebersicht.features", features);
                    }}
                  />
                </div>
              </>
            )}

            {/* === Schritt 2: Vermarktung === */}
            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="hauptbotschaft">Hauptbotschaft (optional)</Label>
                  <Textarea
                    id="hauptbotschaft"
                    placeholder="z.B. Bestes Preis-Leistungs-Verhaeltnis fuer junge Leute"
                    {...register("vermarktung.hauptbotschaft")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nebenbotschaft">Nebenbotschaft (optional)</Label>
                  <Textarea
                    id="nebenbotschaft"
                    placeholder="z.B. Jetzt mit gratis EU-Roaming"
                    {...register("vermarktung.nebenbotschaft")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Zielgruppen</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["neukunden", "bestandskunden", "jugendliche", "familien", "senioren", "geschaeftskunden", "alle"] as const).map((audience) => {
                      const currentAudiences = watch("vermarktung.zielgruppe") || [];
                      const isChecked = currentAudiences.includes(audience);
                      return (
                        <div key={audience} className="flex items-center gap-2">
                          <Checkbox
                            id={`audience-${audience}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const updated = checked
                                ? [...currentAudiences, audience]
                                : currentAudiences.filter((a) => a !== audience);
                              setValue("vermarktung.zielgruppe", updated);
                            }}
                          />
                          <Label htmlFor={`audience-${audience}`} className="text-sm capitalize">
                            {audience.replace(/_/g, " ")}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zielgebiet">Zielgebiet (optional)</Label>
                  <Input
                    id="zielgebiet"
                    placeholder="z.B. Deutschschweiz, ganze Schweiz"
                    {...register("vermarktung.zielgebiet")}
                  />
                </div>

                <ChannelSelector form={form} />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="budget">Budget (optional)</Label>
                    <Input
                      id="budget"
                      placeholder="z.B. CHF 50'000"
                      {...register("vermarktung.budget")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="order_ziel">Order-Ziel (optional)</Label>
                    <Input
                      id="order_ziel"
                      placeholder="z.B. 500 Neuabschluesse"
                      {...register("vermarktung.order_ziel")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Claim-Richtung</Label>
                  <Select
                    value={watch("vermarktung.claim_direction")}
                    onValueChange={(val) => setValue("vermarktung.claim_direction", val as PromoInput["vermarktung"]["claim_direction"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automatisch</SelectItem>
                      <SelectItem value="preis_fokus">Preis-Fokus</SelectItem>
                      <SelectItem value="feature_fokus">Feature-Fokus</SelectItem>
                      <SelectItem value="emotional">Emotional</SelectItem>
                      <SelectItem value="vergleich">Vergleich</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 pt-4">
                  <Label>Sprachen *</Label>
                  <div className="flex gap-4">
                    {(["de", "fr", "it", "en"] as const).map((lang) => {
                      const currentLangs = watch("vermarktung.languages") || [];
                      const isChecked = currentLangs.includes(lang);
                      return (
                        <div key={lang} className="flex items-center gap-2">
                          <Checkbox
                            id={`lang-${lang}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const updated = checked
                                ? [...currentLangs, lang]
                                : currentLangs.filter((l) => l !== lang);
                              setValue("vermarktung.languages", updated as PromoInput["vermarktung"]["languages"]);
                            }}
                          />
                          <Label htmlFor={`lang-${lang}`} className="text-sm uppercase">
                            {lang}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* === Schritt 3: Sujets === */}
            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ads">Ads / Werbemittel (optional)</Label>
                  <Textarea
                    id="ads"
                    placeholder="Beschreibung der gewuenschten Werbemittel..."
                    {...register("sujets.ads")}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    id="website_bilder"
                    checked={watch("sujets.website_bilder")}
                    onCheckedChange={(checked) => setValue("sujets.website_bilder", checked)}
                  />
                  <Label htmlFor="website_bilder">Website-Bilder benoetigt</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sonstiges_sujet">Sonstiges (optional)</Label>
                  <Textarea
                    id="sonstiges_sujet"
                    placeholder="Weitere Informationen zu Sujets..."
                    {...register("sujets.sonstiges_sujet")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="infos_umsetzung">Infos zur Umsetzung (optional)</Label>
                  <Textarea
                    id="infos_umsetzung"
                    placeholder="z.B. Besondere Anforderungen, Referenzen..."
                    {...register("sujets.infos_umsetzung")}
                  />
                </div>
              </>
            )}

            {/* === Schritt 4: Sonstiges === */}
            {step === 4 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="auftraggeber">Auftraggeber (optional)</Label>
                    <Input
                      id="auftraggeber"
                      placeholder="Name / Abteilung"
                      {...register("sonstiges.auftraggeber")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="freigabe">Freigabe durch (optional)</Label>
                    <Input
                      id="freigabe"
                      placeholder="Name / Rolle"
                      {...register("sonstiges.freigabe")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="umsetzung">Umsetzung durch (optional)</Label>
                    <Input
                      id="umsetzung"
                      placeholder="z.B. Agentur / Team"
                      {...register("sonstiges.umsetzung")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bereich">Bereich (optional)</Label>
                    <Input
                      id="bereich"
                      placeholder="z.B. Marketing Schweiz"
                      {...register("sonstiges.bereich")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="at_nummer">AT-Nummer (optional)</Label>
                  <Input
                    id="at_nummer"
                    placeholder="z.B. AT-2026-001"
                    {...register("sonstiges.at_nummer")}
                  />
                </div>

                <div className="border-t pt-4 mt-4 space-y-4">
                  <h3 className="text-lg font-medium">Compliance</h3>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="five_g_badge"
                      checked={watch("sonstiges.five_g_badge")}
                      onCheckedChange={(checked) => setValue("sonstiges.five_g_badge", !!checked)}
                    />
                    <Label htmlFor="five_g_badge">5G Badge erforderlich</Label>
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="swisscom_netz"
                      checked={watch("sonstiges.swisscom_netz_hinweis")}
                      onCheckedChange={(checked) => setValue("sonstiges.swisscom_netz_hinweis", !!checked)}
                    />
                    <Label htmlFor="swisscom_netz">&quot;5G im Swisscom Netz&quot; Hinweis</Label>
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="disclaimer_required"
                      checked={watch("sonstiges.disclaimer_required")}
                      onCheckedChange={(checked) => setValue("sonstiges.disclaimer_required", !!checked)}
                    />
                    <Label htmlFor="disclaimer_required">Disclaimer erforderlich</Label>
                  </div>

                  {watch("sonstiges.disclaimer_required") && (
                    <div className="space-y-2">
                      <Label htmlFor="disclaimer_text">Disclaimer-Text</Label>
                      <Textarea
                        id="disclaimer_text"
                        placeholder="Disclaimer-Text hier eingeben..."
                        {...register("sonstiges.disclaimer_text")}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="legal_review"
                      checked={watch("sonstiges.legal_review_required")}
                      onCheckedChange={(checked) => setValue("sonstiges.legal_review_required", !!checked)}
                    />
                    <Label htmlFor="legal_review">Rechtliche Pruefung noetig</Label>
                  </div>
                </div>

                {/* Einschraenkungen */}
                <div className="space-y-2">
                  <Label htmlFor="restrictions">Einschraenkungen (optional)</Label>
                  <Textarea
                    id="restrictions"
                    placeholder="Eine Einschraenkung pro Zeile"
                    onChange={(e) => {
                      const restrictions = e.target.value
                        .split("\n")
                        .map((r) => r.trim())
                        .filter(Boolean);
                      setValue("restrictions", restrictions);
                    }}
                  />
                </div>
              </>
            )}

            {/* === Schritt 5: Timeline + Review === */}
            {step === 5 && (
              <>
                <TimelineInput form={form} />

                {/* Zusammenfassung */}
                <div className="rounded-md bg-muted p-4 space-y-2 text-sm mt-6">
                  <h4 className="font-medium">Zusammenfassung</h4>
                  <p>Kampagne: {watch("kampagne.name")}</p>
                  <p>Promo-ID: {watch("kampagne.id")}</p>
                  <p>Zeitraum: {watch("kampagne.datum_von")} bis {watch("kampagne.datum_bis")}</p>
                  <p>Produkt: {watch("produktuebersicht.produkt")} ({watch("produktuebersicht.produkt_typ")})</p>
                  <p>Preis: CHF {watch("produktuebersicht.promoangebot.price_new")?.toFixed(2)} {watch("produktuebersicht.promoangebot.price_suffix")}</p>
                  {watch("vermarktung.hauptbotschaft") && (
                    <p>Hauptbotschaft: {watch("vermarktung.hauptbotschaft")}</p>
                  )}
                  <p>Kanaele: {Object.entries(watch("vermarktung.massnahmen"))
                    .filter(([, v]) => v.enabled)
                    .map(([k]) => k)
                    .join(", ")}</p>
                  <p>Sprachen: {watch("vermarktung.languages")?.join(", ").toUpperCase()}</p>
                  {watch("sonstiges.auftraggeber") && (
                    <p>Auftraggeber: {watch("sonstiges.auftraggeber")}</p>
                  )}
                  {watch("vermarktung.budget") && (
                    <p>Budget: {watch("vermarktung.budget")}</p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={step === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurueck
          </Button>

          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={goNext}>
              Weiter
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Kampagne erstellen
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
