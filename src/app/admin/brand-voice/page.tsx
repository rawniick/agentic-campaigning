import Link from "next/link";
import { getDb } from "@/lib/db/server";
import { getActiveBrandConfig } from "@/lib/brand/server";
import { getAllVoiceVariants } from "@/lib/db/queries/brand-voice";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  setDefaultVoiceAction,
  upsertVoiceVariantAction,
  deleteVoiceVariantAction,
} from "./_actions";

export const dynamic = "force-dynamic";

const ARTS = [
  { value: "flash_sale", label: "Flash Sale" },
  { value: "standard", label: "Standard" },
] as const;

const ZIELGRUPPEN = [
  { value: "sozial", label: "Sozial (Jung)" },
  { value: "rational", label: "Rational (Aelter)" },
  { value: "nativ", label: "Nativ (Editorial)" },
] as const;

export default async function BrandVoicePage() {
  const brand = await getActiveBrandConfig();
  const variants = await getAllVoiceVariants(getDb(), brand.brand.id);

  const defaultVoice = variants.find((v) => v.is_default);
  const matrixMap = new Map<string, string>();
  for (const v of variants) {
    if (!v.is_default && v.kampagne_art && v.zielgruppe) {
      matrixMap.set(`${v.kampagne_art}__${v.zielgruppe}`, v.tov_md);
    }
  }
  const variantIdMap = new Map<string, string>();
  for (const v of variants) {
    if (!v.is_default && v.kampagne_art && v.zielgruppe) {
      variantIdMap.set(`${v.kampagne_art}__${v.zielgruppe}`, v.id);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Brand Voice</h1>
          <p className="text-sm text-muted-foreground">
            Tone of Voice fuer {brand.brand.name}. Default + Overrides pro Kombination Kampagnenart × Zielgruppe.
          </p>
        </div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
      </div>

      {/* Default-TOV */}
      <section className="mb-10 rounded-md border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Default Voice</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Greift wenn keine spezifische Variante fuer Kampagnenart × Zielgruppe existiert.
          Pflichtfeld — ohne Default wirft generateCopy.
        </p>
        <form action={setDefaultVoiceAction} className="space-y-3">
          <Label htmlFor="tov_md" className="sr-only">
            Default TOV
          </Label>
          <Textarea
            id="tov_md"
            name="tov_md"
            required
            rows={8}
            defaultValue={defaultVoice?.tov_md ?? ""}
            placeholder="# Wingo Default Voice&#10;- Direkt, klar, schweizerisch.&#10;- Du-Form.&#10;..."
          />
          <Button type="submit">Default speichern</Button>
        </form>
      </section>

      {/* Matrix */}
      <section className="rounded-md border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Matrix: Kampagnenart × Zielgruppe</h2>
        <p className="mb-6 text-xs text-muted-foreground">
          Pro Zelle optionaler Override. Leer = Default wird verwendet.
        </p>

        <div className="space-y-8">
          {ARTS.map((art) => (
            <div key={art.value}>
              <h3 className="mb-3 text-base font-semibold">{art.label}</h3>
              <div className="grid gap-4 md:grid-cols-3">
                {ZIELGRUPPEN.map((zg) => {
                  const key = `${art.value}__${zg.value}`;
                  const existing = matrixMap.get(key);
                  const variantId = variantIdMap.get(key);
                  return (
                    <div
                      key={key}
                      className="rounded-md border bg-background p-4 space-y-3"
                    >
                      <div className="text-sm font-medium">{zg.label}</div>
                      <form action={upsertVoiceVariantAction} className="space-y-2">
                        <input type="hidden" name="kampagne_art" value={art.value} />
                        <input type="hidden" name="zielgruppe" value={zg.value} />
                        <Textarea
                          name="tov_md"
                          rows={5}
                          defaultValue={existing ?? ""}
                          placeholder="(leer = Default)"
                          className="text-xs"
                        />
                        <Button type="submit" size="sm">
                          Speichern
                        </Button>
                      </form>
                      {variantId && (
                        <form action={deleteVoiceVariantAction}>
                          <input type="hidden" name="id" value={variantId} />
                          <Button type="submit" size="sm" variant="outline">
                            Override loeschen
                          </Button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
