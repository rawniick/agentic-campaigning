import Link from "next/link";
import { getDb } from "@/lib/db/server";
import { getActiveBrandConfig } from "@/lib/brand/server";
import { listHeroLibrary } from "@/lib/db/queries/hero-library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  uploadHeroToLibraryAction,
  deleteHeroLibraryEntryAction,
  seedHeroLibraryFromSamplesAction,
} from "./_actions";

export const dynamic = "force-dynamic";

export default async function HeroLibraryPage() {
  const brand = await getActiveBrandConfig();
  const entries = await listHeroLibrary(getDb(), brand.brand.id);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Hero Library</h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} Bild(er) fuer {brand.brand.name}. Gate 2 zieht
            Vorschlaege hier raus.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form action={seedHeroLibraryFromSamplesAction}>
            <Button type="submit" variant="outline" size="sm">
              Aus samples/ importieren
            </Button>
          </form>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      <section className="mb-10 rounded-md border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Neues Hero hochladen</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Tags als komma-separierte Listen (kleinschreibung), z.B.{" "}
          <code>mobile, internet</code>.
        </p>
        <form
          action={uploadHeroToLibraryAction}
          className="space-y-4"
          encType="multipart/form-data"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Anzeige-Name</Label>
            <Input id="name" name="name" required placeholder="z.B. Sport Lifestyle Sommer 1" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero">Bilddatei (JPG/PNG/WebP)</Label>
            <input
              id="hero"
              name="hero"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              className="border-input bg-background h-10 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="categories">Kategorien</Label>
              <Input id="categories" name="categories" placeholder="mobile, tv, internet" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lifestyles">Lifestyles</Label>
              <Input
                id="lifestyles"
                name="lifestyles"
                placeholder="sport, familie, junge, senioren"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seasons">Saison</Label>
              <Input id="seasons" name="seasons" placeholder="weihnachten, sommer, always_on" />
            </div>
          </div>
          <Button type="submit">Hochladen</Button>
        </form>
      </section>

      <section className="rounded-md border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Bibliothek</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          {entries.length === 0
            ? "Noch leer."
            : "Klick Loeschen um einen Eintrag zu entfernen."}
        </p>
        {entries.length === 0 ? null : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {entries.map((e) => (
              <div
                key={e.id}
                className="rounded-md border bg-background p-3 space-y-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.storage_url}
                  alt={e.name}
                  className="h-40 w-full rounded border bg-muted object-cover"
                />
                <div className="text-sm font-medium">{e.name}</div>
                <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                  {[...e.categories, ...e.lifestyles, ...e.seasons].map((t) => (
                    <span
                      key={t}
                      className="rounded bg-muted px-1.5 py-0.5"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <form action={deleteHeroLibraryEntryAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Loeschen
                  </Button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
