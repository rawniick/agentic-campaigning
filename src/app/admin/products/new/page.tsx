import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createProductAction } from "../_actions";

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-bold">Neues Produkt</h1>
      <p className="mt-1 text-sm text-muted-foreground">Wingo Master-Data.</p>

      <form action={createProductAction} className="mt-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" name="name" required placeholder="Wingo Mobile Swiss" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="category">Kategorie *</Label>
            <select
              id="category"
              name="category"
              required
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              defaultValue="mobile"
            >
              <option value="mobile">Mobile</option>
              <option value="internet">Internet</option>
              <option value="tv">TV</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="network">Netz</Label>
            <select
              id="network"
              name="network"
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              defaultValue=""
            >
              <option value="">—</option>
              <option value="5g_swisscom">5G Swisscom</option>
              <option value="4g_swisscom">4G Swisscom</option>
              <option value="other">Anderes</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price_promo">Preis Promo (CHF) *</Label>
            <Input
              id="price_promo"
              name="price_promo"
              type="number"
              step="0.01"
              required
              placeholder="19.95"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price_standard">Preis Standard</Label>
            <Input
              id="price_standard"
              name="price_standard"
              type="number"
              step="0.01"
              placeholder="29.95"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price_suffix">Suffix</Label>
            <Input id="price_suffix" name="price_suffix" defaultValue="/Mt." />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="link">Website-Link</Label>
          <Input id="link" name="link" type="url" placeholder="https://wingo.ch/..." />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" placeholder="WMS-2026" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="features">Features (1 pro Zeile)</Label>
          <Textarea
            id="features"
            name="features"
            placeholder="Unlimitiert telefonieren&#10;5G im Swisscom Netz&#10;30 GB Daten"
            rows={4}
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit">Anlegen</Button>
          <Link href="/admin/products">
            <Button type="button" variant="outline">
              Abbrechen
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
