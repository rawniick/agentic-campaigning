import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-4xl font-bold">ACE — Wingo Campaign Engine</h1>
      <p className="mt-2 text-muted-foreground">
        Phase 2 — 5-Gate-Flow. Brief → Copy → Hero → Layout → Final → Asset.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Neue Kampagne</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Brief eingeben und durch 5 Gates fuehren.
            </p>
            <Link href="/campaigns/new" className="mt-4 inline-block">
              <Button>Brief starten</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produkte</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Master-Daten.</p>
            <Link href="/admin/products" className="mt-4 inline-block">
              <Button variant="outline">Produkte</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Brand Voice</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Default-TOV + Matrix Art × Zielgruppe.
            </p>
            <Link href="/admin/brand-voice" className="mt-4 inline-block">
              <Button variant="outline">Brand Voice</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <p className="mt-12 text-xs text-muted-foreground">
        Siehe <code>docs/PRD-Wingo-V1.md</code> und <code>plans/wingo-v1.md</code>.
      </p>
    </div>
  );
}
