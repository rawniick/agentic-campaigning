import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-4xl font-bold">ACE — Wingo Campaign Engine</h1>
      <p className="mt-2 text-muted-foreground">
        Phase 1 Tracer Bullet. Brief → Halfpage 300×600 DE end-to-end.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Neue Kampagne</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Brief eingeben und eine Halfpage rendern.
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
            <p className="text-sm text-muted-foreground">
              Wingo Master-Daten verwalten.
            </p>
            <Link href="/admin/products" className="mt-4 inline-block">
              <Button variant="outline">Produkte ansehen</Button>
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
