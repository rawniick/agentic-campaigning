"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Product } from "@/lib/db/queries/products";
import type { Brief } from "@/lib/schemas/brief";
import { submitBriefAction } from "../_actions";

interface Props {
  products: Product[];
}

export function BriefForm({ products }: Props) {
  const [productId, setProductId] = useState<string>(products[0]?.id ?? "");
  const [pricePromo, setPricePromo] = useState<string>(
    products[0]?.price_promo.toFixed(2) ?? ""
  );
  const [pricestd, setPriceStd] = useState<string>(
    products[0]?.price_standard !== undefined &&
      products[0]?.price_standard !== null
      ? products[0].price_standard.toFixed(2)
      : ""
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onProductChange(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) {
      setPricePromo(p.price_promo.toFixed(2));
      setPriceStd(p.price_standard?.toFixed(2) ?? "");
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    const product = products.find((p) => p.id === productId);
    if (!product) {
      setError("Bitte Produkt waehlen");
      return;
    }

    const brief: Brief = {
      kampagne: {
        name: String(formData.get("kampagne_name")),
        art: "flash_sale",
        datum_von: String(formData.get("datum_von")),
        datum_bis: String(formData.get("datum_bis")),
        produkt_kategorie: product.category,
      },
      produkt: {
        name: product.name,
        website_link: product.link ?? undefined,
        preis_promo: Number(pricePromo),
        preis_standard: pricestd ? Number(pricestd) : undefined,
        preis_suffix: product.price_suffix,
      },
      strategie: {
        input: String(formData.get("strategie_input")),
      },
      vermarktung: {
        hauptbotschaft: String(formData.get("hauptbotschaft")),
        nebenbotschaft: String(formData.get("nebenbotschaft") ?? "") || undefined,
        zielgruppe: (formData.get("zielgruppe") ?? "sozial") as Brief["vermarktung"]["zielgruppe"],
        zielgebiet: (formData.get("zielgebiet") ?? "deutschschweiz") as Brief["vermarktung"]["zielgebiet"],
      },
      assets_kanaele: {
        channel_kategorien: ["Display Standard"],
        format_codes: ["dv360_halfpage"],
      },
      sonstiges: {
        auftraggeber: String(formData.get("auftraggeber") ?? "") || undefined,
      },
    };

    startTransition(async () => {
      try {
        await submitBriefAction({ brief, productId: product.id });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  if (products.length === 0) {
    return (
      <div className="mt-8 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
        Keine Produkte vorhanden. Lege erst eines an unter{" "}
        <a href="/admin/products/new" className="underline">
          /admin/products/new
        </a>
        .
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-8">
      {/* Sektion 1: Kampagne */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">1. Kampagne</h2>
        <div className="space-y-2">
          <Label htmlFor="kampagne_name">Name *</Label>
          <Input
            id="kampagne_name"
            name="kampagne_name"
            required
            placeholder="Wingo Mobile Swiss — Flash Sale Mai"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="datum_von">Datum von *</Label>
            <Input id="datum_von" name="datum_von" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="datum_bis">Datum bis *</Label>
            <Input id="datum_bis" name="datum_bis" type="date" required />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Art = <strong>Flash Sale</strong> (V1 Tracer fix).
        </p>
      </section>

      {/* Sektion 2: Produkt */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">2. Produkt</h2>
        <div className="space-y-2">
          <Label htmlFor="product">Produkt *</Label>
          <select
            id="product"
            value={productId}
            onChange={(e) => onProductChange(e.target.value)}
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            required
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.category})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="preis_promo">Preis Promo *</Label>
            <Input
              id="preis_promo"
              type="number"
              step="0.01"
              value={pricePromo}
              onChange={(e) => setPricePromo(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preis_standard">Preis Standard</Label>
            <Input
              id="preis_standard"
              type="number"
              step="0.01"
              value={pricestd}
              onChange={(e) => setPriceStd(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Sektion 3: Strategie */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">3. Strategie</h2>
        <div className="space-y-2">
          <Label htmlFor="strategie_input">Strategischer Input *</Label>
          <Textarea
            id="strategie_input"
            name="strategie_input"
            required
            rows={3}
            placeholder="Warum diese Kampagne? Marktentwicklung, Konkurrenz, rechtliche Anpassungen ..."
          />
        </div>
      </section>

      {/* Sektion 4: Vermarktung */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">4. Vermarktung</h2>
        <div className="space-y-2">
          <Label htmlFor="hauptbotschaft">Hauptbotschaft *</Label>
          <Input id="hauptbotschaft" name="hauptbotschaft" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nebenbotschaft">Nebenbotschaft</Label>
          <Input id="nebenbotschaft" name="nebenbotschaft" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="zielgruppe">Zielgruppe</Label>
            <select
              id="zielgruppe"
              name="zielgruppe"
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              defaultValue="sozial"
            >
              <option value="sozial">Sozial (Jung)</option>
              <option value="rational">Rational (Aelter)</option>
              <option value="nativ">Nativ (Editorial)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="zielgebiet">Zielgebiet</Label>
            <select
              id="zielgebiet"
              name="zielgebiet"
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              defaultValue="deutschschweiz"
            >
              <option value="deutschschweiz">Deutschschweiz</option>
              <option value="westschweiz">Westschweiz</option>
              <option value="it_schweiz">IT-Schweiz</option>
              <option value="ganze_schweiz">Ganze Schweiz</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">5. Sonstiges</h2>
        <div className="space-y-2">
          <Label htmlFor="auftraggeber">Auftraggeber</Label>
          <Input id="auftraggeber" name="auftraggeber" placeholder="Wingo Marketing" />
        </div>
      </section>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Generiere ..." : "Kampagne starten"}
        </Button>
        <a
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground self-center"
        >
          Abbrechen
        </a>
      </div>

      <p className="text-xs text-muted-foreground">
        V1 Tracer: nur Halfpage 300×600 in DE. Pipeline ruft Claude (real),
        rendert via Satori, laedt zu Supabase Storage hoch.
      </p>
    </form>
  );
}
