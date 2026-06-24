import Link from "next/link";
import { getDb } from "@/lib/db/server";

export const dynamic = "force-dynamic";

import { getActiveBrandConfig } from "@/lib/brand/server";
import { getProductsForBrand } from "@/lib/db/queries/products";
import { Button } from "@/components/ui/button";
import { RefreshPricesButton } from "./RefreshPricesButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminProductsPage() {
  const brand = await getActiveBrandConfig();
  const products = await getProductsForBrand(getDb(), brand.brand.id);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Produkte</h1>
          <p className="text-sm text-muted-foreground">
            Wingo Master-Daten. {products.length} aktive Produkte.
          </p>
        </div>
        <Link href="/admin/products/new">
          <Button>Neues Produkt</Button>
        </Link>
      </div>

      <div className="mb-6">
        <RefreshPricesButton />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kategorie</TableHead>
            <TableHead>Promo</TableHead>
            <TableHead>Standard</TableHead>
            <TableHead>Netz</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Keine Produkte. Lege via &quot;Neues Produkt&quot; eines an.
              </TableCell>
            </TableRow>
          ) : (
            products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.category}</TableCell>
                <TableCell>{p.price_promo.toFixed(2)} CHF{p.price_suffix}</TableCell>
                <TableCell>
                  {p.price_standard !== null
                    ? `${p.price_standard.toFixed(2)} CHF${p.price_suffix}`
                    : "—"}
                </TableCell>
                <TableCell>{p.network ?? "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="mt-8">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Zurück zum Dashboard
        </Link>
      </div>
    </div>
  );
}
