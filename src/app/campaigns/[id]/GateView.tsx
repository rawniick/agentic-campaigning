"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  approveCopyGateAction,
  uploadHeroGateAction,
  selectHeroFromLibraryGateAction,
  selectLayoutGateAction,
  finalRenderGateAction,
  promoteHeroToLibraryGateAction,
  reopenGateAction,
} from "./_gate-actions";

interface LibraryEntry {
  id: string;
  name: string;
  storage_url: string;
  categories: string[];
  lifestyles: string[];
  seasons: string[];
}

interface Props {
  campaignId: string;
  status: string;
  copy:
    | {
        headlines: string[];
        subline: string;
        cta_label: string;
        selected_headline_idx: number | null;
        is_approved: boolean;
      }
    | null;
  hero:
    | {
        storage_url: string;
        is_approved: boolean;
        source: string;
      }
    | null;
  layout:
    | {
        master_format: string;
        variant: string;
        is_approved: boolean;
      }
    | null;
  assets: Array<{ id: string; storage_url: string; language: string }>;
  libraryEntries: LibraryEntry[];
}

function GateBadge({ active, done }: { active: boolean; done: boolean }) {
  const cls = done
    ? "bg-green-600 text-white"
    : active
      ? "bg-amber-500 text-white"
      : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${cls}`}
    >
      ●
    </span>
  );
}

export function GateView({
  campaignId,
  status,
  copy,
  hero,
  layout,
  assets,
  libraryEntries,
}: Props) {
  const [selectedHeadlineIdx, setSelectedHeadlineIdx] = useState<number>(0);

  const inCopy = status === "copy_pending";
  const inHero = status === "hero_pending";
  const inLayout = status === "layout_pending";
  const inFinal = status === "final_pending";
  const isDone = status === "done";
  const isFailed = status === "failed";

  const doneCopy = !!copy?.is_approved;
  const doneHero = !!hero?.is_approved;
  const doneLayout = !!layout?.is_approved;
  const doneRender = isDone;

  return (
    <div className="space-y-8">
      {/* Stepper */}
      <ol className="flex flex-wrap gap-2 text-sm">
        <li className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
          <GateBadge active={inCopy} done={doneCopy} />
          Gate 1 Copy
        </li>
        <li className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
          <GateBadge active={inHero} done={doneHero} />
          Gate 2 Hero
        </li>
        <li className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
          <GateBadge active={inLayout} done={doneLayout} />
          Gate 3 Layout
        </li>
        <li className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
          <GateBadge active={inFinal} done={doneRender} />
          Gate 4 Final
        </li>
        {isFailed && (
          <li className="rounded-md border bg-red-50 px-3 py-2 text-sm text-red-800">
            Render failed
          </li>
        )}
      </ol>

      {/* Gate 1: Copy */}
      {inCopy && copy && (
        <section className="rounded-md border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Gate 1 — Copy waehlen</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Drei Headlines generiert von Claude. Pick eine, bestaetige.
            Subline + CTA sind fest.
          </p>
          <form action={approveCopyGateAction} className="space-y-4">
            <input type="hidden" name="campaignId" value={campaignId} />
            <input type="hidden" name="headlineIndex" value={selectedHeadlineIdx} />
            <div className="space-y-2">
              {copy.headlines.map((h, i) => (
                <label
                  key={i}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                    selectedHeadlineIdx === i
                      ? "border-primary bg-primary/5"
                      : "border-input"
                  }`}
                >
                  <input
                    type="radio"
                    checked={selectedHeadlineIdx === i}
                    onChange={() => setSelectedHeadlineIdx(i)}
                    className="mt-1"
                  />
                  <span className="text-sm">{h}</span>
                </label>
              ))}
            </div>
            <div className="rounded-md bg-muted p-3 text-xs">
              <div>
                <strong>Subline:</strong> {copy.subline}
              </div>
              <div>
                <strong>CTA:</strong> {copy.cta_label}
              </div>
            </div>
            <Button type="submit">Copy freigeben</Button>
          </form>
        </section>
      )}

      {/* Gate 2: Hero (Library Picker + Upload) */}
      {inHero && (
        <section className="rounded-md border bg-card p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Gate 2 — Hero-Bild</h2>
            <p className="text-xs text-muted-foreground">
              Pick aus der Library oder lade ein eigenes Bild hoch. AI-Gen folgt
              in einer spaeteren Slice.
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">
              Library ({libraryEntries.length})
            </h3>
            {libraryEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Noch keine Bilder in der Library.{" "}
                <a
                  href="/admin/hero-library"
                  className="underline hover:text-foreground"
                >
                  Pflegen
                </a>
                .
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {libraryEntries.map((e) => (
                  <form
                    key={e.id}
                    action={selectHeroFromLibraryGateAction}
                    className="space-y-2 rounded-md border bg-background p-3"
                  >
                    <input type="hidden" name="campaignId" value={campaignId} />
                    <input type="hidden" name="libraryEntryId" value={e.id} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={e.storage_url}
                      alt={e.name}
                      className="h-28 w-full rounded border bg-muted object-cover"
                    />
                    <div className="truncate text-xs font-medium">{e.name}</div>
                    <Button type="submit" size="sm" className="w-full">
                      Pick this
                    </Button>
                  </form>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border-t pt-6">
            <h3 className="mb-3 text-sm font-semibold">Eigenes Bild hochladen</h3>
            <form
              action={uploadHeroGateAction}
              className="space-y-4"
              encType="multipart/form-data"
            >
              <input type="hidden" name="campaignId" value={campaignId} />
              <div className="space-y-2">
                <Label htmlFor="hero">Bilddatei (JPG/PNG)</Label>
                <input
                  id="hero"
                  name="hero"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  className="border-input bg-background h-10 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <Button type="submit" variant="outline">
                Hero hochladen
              </Button>
            </form>
          </div>
        </section>
      )}

      {/* Gate 3: Layout-Variante */}
      {inLayout && (
        <section className="rounded-md border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Gate 3 — Layout-Variante</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Wo soll der Preis stehen? Auswahl ist sicher — alle Varianten
            sind brand-konform.
          </p>
          <form action={selectLayoutGateAction} className="space-y-4">
            <input type="hidden" name="campaignId" value={campaignId} />
            <input type="hidden" name="masterFormat" value="dv360_halfpage" />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex cursor-pointer flex-col gap-2 rounded-md border p-4 hover:border-primary">
                <input type="radio" name="variant" value="price_bottom" defaultChecked />
                <span className="text-sm font-medium">Price Bottom</span>
                <span className="text-xs text-muted-foreground">
                  Hero oben, Headline mittig, Preis + CTA unten. Default.
                </span>
              </label>
              <label className="flex cursor-pointer flex-col gap-2 rounded-md border p-4 hover:border-primary">
                <input type="radio" name="variant" value="price_top" />
                <span className="text-sm font-medium">Price Top</span>
                <span className="text-xs text-muted-foreground">
                  Preis prominent oben, Hero mittig, CTA unten.
                </span>
              </label>
            </div>
            <Button type="submit">Layout freigeben</Button>
          </form>
        </section>
      )}

      {/* Gate 4: Final */}
      {inFinal && (
        <section className="rounded-md border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Gate 4 — Final Render</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Engine rendert jetzt die Halfpage. Nach Klick: Asset entsteht in
            Supabase Storage.
          </p>
          <form action={finalRenderGateAction}>
            <input type="hidden" name="campaignId" value={campaignId} />
            <Button type="submit">Rendern</Button>
          </form>
        </section>
      )}

      {/* Done */}
      {isDone && (
        <section className="rounded-md border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Fertig</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {assets.length} Asset(s) gerendert.
          </p>
          {assets.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {assets.map((a) => (
                <div key={a.id} className="rounded-md border bg-background p-3">
                  <div className="mb-2 text-xs text-muted-foreground">
                    {a.language.toUpperCase()}
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.storage_url}
                    alt=""
                    className="w-full rounded border bg-white"
                  />
                  <a
                    href={a.storage_url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm underline"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Hero in Library aufnehmen — sichtbar nur wenn Hero nicht selbst aus
          der Library kam (sonst Duplikat). */}
      {isDone && hero && hero.source !== "library" && (
        <section className="rounded-md border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Hero in Library aufnehmen</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Macht das verwendete Hero-Bild fuer kommende Kampagnen wiederverwendbar.
          </p>
          <form action={promoteHeroToLibraryGateAction} className="space-y-4">
            <input type="hidden" name="campaignId" value={campaignId} />
            <div className="space-y-2">
              <Label htmlFor="lib-name">Anzeige-Name</Label>
              <Input
                id="lib-name"
                name="name"
                required
                placeholder="z.B. Familie Picknick Sommer"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="lib-categories">Kategorien</Label>
                <Input
                  id="lib-categories"
                  name="categories"
                  placeholder="mobile, tv, internet"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lib-lifestyles">Lifestyles</Label>
                <Input
                  id="lib-lifestyles"
                  name="lifestyles"
                  placeholder="sport, familie, junge"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lib-seasons">Saison</Label>
                <Input
                  id="lib-seasons"
                  name="seasons"
                  placeholder="weihnachten, sommer, always_on"
                />
              </div>
            </div>
            <Button type="submit" variant="outline">
              In Library aufnehmen
            </Button>
          </form>
        </section>
      )}

      {/* Re-Open Buttons (verfuegbar ab final_pending oder spaeter) */}
      {(inFinal || isDone || isFailed) && (
        <section className="rounded-md border border-dashed bg-card p-6 text-sm">
          <h2 className="mb-3 font-semibold">Zurueck zu einem fr&uuml;heren Gate</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            <strong>Hard-Reset:</strong> alle nachgelagerten Daten werden geloescht.
          </p>
          <div className="flex flex-wrap gap-2">
            {["copy", "hero", "layout", "final"].map((target) => (
              <form key={target} action={reopenGateAction}>
                <input type="hidden" name="campaignId" value={campaignId} />
                <input type="hidden" name="target" value={target} />
                <Button type="submit" variant="outline" size="sm">
                  Gate {target === "copy" ? "1" : target === "hero" ? "2" : target === "layout" ? "3" : "4"}
                </Button>
              </form>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
