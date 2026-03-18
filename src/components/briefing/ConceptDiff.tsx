import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitCompare } from "lucide-react";

interface ConceptDiffProps {
  previous: {
    leitidee?: string;
    claims?: string[];
    hero_message?: string;
    positionierung?: string;
    kreativ_richtung?: string;
  };
  current: {
    leitidee?: string;
    claims?: string[];
    hero_message?: string;
    positionierung?: string;
    kreativ_richtung?: string;
  };
  iterationFrom: number;
  iterationTo: number;
}

// Vergleich zwischen zwei Konzept-Iterationen
export function ConceptDiff({
  previous,
  current,
  iterationFrom,
  iterationTo,
}: ConceptDiffProps) {
  const fields = [
    { key: "positionierung", label: "Positionierung" },
    { key: "kreativ_richtung", label: "Kreativ-Richtung" },
    { key: "leitidee", label: "Leitidee" },
    { key: "hero_message", label: "Hero Message" },
  ] as const;

  const changedFields = fields.filter(
    (f) => (previous[f.key] ?? "") !== (current[f.key] ?? "")
  );

  // Claims vergleichen
  const prevClaims = previous.claims ?? [];
  const currClaims = current.claims ?? [];
  const claimsChanged = JSON.stringify(prevClaims) !== JSON.stringify(currClaims);

  if (changedFields.length === 0 && !claimsChanged) {
    return null; // Keine Aenderungen
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-blue-500" />
          <CardTitle className="text-sm">
            Aenderungen: Iteration {iterationFrom} → {iterationTo}
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {changedFields.length + (claimsChanged ? 1 : 0)} Felder
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {changedFields.map((field) => (
          <div key={field.key} className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              {field.label}
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-red-50 dark:bg-red-950/30 p-2 line-through opacity-60">
                {previous[field.key] || "–"}
              </div>
              <div className="rounded bg-green-50 dark:bg-green-950/30 p-2">
                {current[field.key] || "–"}
              </div>
            </div>
          </div>
        ))}

        {claimsChanged && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Claims</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-red-50 dark:bg-red-950/30 p-2 space-y-1">
                {prevClaims.map((c, i) => (
                  <div key={i} className="opacity-60">{i + 1}. {c}</div>
                ))}
              </div>
              <div className="rounded bg-green-50 dark:bg-green-950/30 p-2 space-y-1">
                {currClaims.map((c, i) => (
                  <div key={i}>{i + 1}. {c}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
