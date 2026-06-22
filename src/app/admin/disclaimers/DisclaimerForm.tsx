import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DisclaimerRow } from "@/lib/db/queries/disclaimers";

const TEXTAREA_CLS =
  "border-input bg-background w-full rounded-md border px-3 py-2 text-sm";

export function DisclaimerForm({
  action,
  initial,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial?: DisclaimerRow;
  submitLabel: string;
}) {
  const texts = [
    { lang: "DE", name: "text_de", value: initial?.text_de },
    { lang: "FR", name: "text_fr", value: initial?.text_fr },
    { lang: "IT", name: "text_it", value: initial?.text_it },
    { lang: "EN", name: "text_en", value: initial?.text_en },
  ];

  return (
    <form action={action} className="space-y-5">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="slug">Slug (eindeutig pro Brand)</Label>
          <Input
            id="slug"
            name="slug"
            required
            defaultValue={initial?.slug}
            placeholder="5g_swisscom_netz"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name (intern)</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={initial?.name}
            placeholder="5G im Swisscom Netz"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="applies_to_categories">
          Kategorien (Komma-getrennt, leer = alle)
        </Label>
        <Input
          id="applies_to_categories"
          name="applies_to_categories"
          defaultValue={initial?.applies_to_categories.join(", ")}
          placeholder="mobile, tv, internet"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="conditions_json">
          Conditions (JSON-Objekt, leer = greift immer)
        </Label>
        <textarea
          id="conditions_json"
          name="conditions_json"
          rows={2}
          defaultValue={initial ? JSON.stringify(initial.conditions_json) : ""}
          placeholder={'{"network":"5g"}'}
          className={`${TEXTAREA_CLS} font-mono`}
        />
        <p className="text-xs text-muted-foreground">
          Gematcht gegen Produkt-Kontext (z.B. <code>network</code>,{" "}
          <code>has_hardware</code>). Jeder Schluessel muss exakt passen.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {texts.map((t) => (
          <div key={t.name} className="space-y-2">
            <Label htmlFor={t.name}>Text {t.lang}</Label>
            <textarea
              id={t.name}
              name={t.name}
              rows={2}
              required
              defaultValue={t.value}
              className={TEXTAREA_CLS}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_required"
            defaultChecked={initial ? initial.is_required : true}
          />
          Pflicht-Disclaimer (<code>is_required</code>)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={initial ? initial.is_active : true}
          />
          Aktiv (im Live-Match)
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Aktiv-Haken aus = matcht keine NEUEN Kampagnen mehr. Bereits freigegebene
        Kampagnen behalten ihren Text (Compliance — Aenderungen wirken nicht
        rueckwirkend).
      </p>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
