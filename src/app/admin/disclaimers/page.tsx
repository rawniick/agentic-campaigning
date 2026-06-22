import Link from "next/link";
import { getDb } from "@/lib/db/server";
import { getActiveBrandConfig } from "@/lib/brand/server";
import { listAllDisclaimers } from "@/lib/db/queries/disclaimers";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteDisclaimerAction } from "./_actions";
import { DeleteDisclaimerButton } from "./DeleteDisclaimerButton";

export const dynamic = "force-dynamic";

export default async function AdminDisclaimersPage() {
  const brand = await getActiveBrandConfig();
  const rows = await listAllDisclaimers(getDb(), brand.brand.id);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Disclaimer</h1>
          <p className="text-sm text-muted-foreground">
            Pflichttexte fuer {brand.brand.name}. {rows.length} Eintrag(e). Werden
            conditions-basiert gematcht + verbatim (nie via LLM) gerendert.
          </p>
        </div>
        <Link href="/admin/disclaimers/new">
          <Button>Neuer Disclaimer</Button>
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slug</TableHead>
            <TableHead>Kategorien</TableHead>
            <TableHead>Conditions</TableHead>
            <TableHead>Text DE</TableHead>
            <TableHead>Pflicht</TableHead>
            <TableHead>Aktiv</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Noch keine Disclaimer. Lege via &quot;Neuer Disclaimer&quot; einen an.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.slug}</TableCell>
                <TableCell className="text-xs">
                  {d.applies_to_categories.length
                    ? d.applies_to_categories.join(", ")
                    : "alle"}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {Object.keys(d.conditions_json).length
                    ? JSON.stringify(d.conditions_json)
                    : "—"}
                </TableCell>
                <TableCell className="max-w-[18rem] truncate text-xs" title={d.text_de}>
                  {d.text_de}
                </TableCell>
                <TableCell>{d.is_required ? "ja" : "nein"}</TableCell>
                <TableCell>{d.is_active ? "ja" : "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/admin/disclaimers/${d.id}/edit`}>
                      <Button size="sm" variant="outline">
                        Bearbeiten
                      </Button>
                    </Link>
                    <form action={deleteDisclaimerAction}>
                      <input type="hidden" name="id" value={d.id} />
                      <DeleteDisclaimerButton slug={d.slug} />
                    </form>
                  </div>
                </TableCell>
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
