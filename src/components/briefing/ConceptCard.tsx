import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, MessageSquare, Image, Star } from "lucide-react";
import type { Concept } from "@/types/database";

interface ConceptCardProps {
  concept: Concept;
}

export function ConceptCard({ concept }: ConceptCardProps) {
  const claims = concept.claims?.variants ?? [];
  const recommendedIndex = concept.recommended_claim_index ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4" />
            {concept.variant_label}
          </CardTitle>
          {concept.is_selected && <Badge variant="default">Aktiv</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Leitidee */}
        {concept.leitidee && (
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-muted-foreground">Leitidee</h4>
            <p className="text-lg font-medium">{concept.leitidee}</p>
          </div>
        )}

        {/* Claims */}
        {claims.length > 0 && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              Claims
            </h4>
            <ul className="space-y-1">
              {claims.map((claim, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm"
                  style={{
                    backgroundColor: i === recommendedIndex ? "hsl(var(--accent))" : undefined,
                  }}
                >
                  {i === recommendedIndex && (
                    <Star className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span>{claim}</span>
                  {i === recommendedIndex && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      Empfohlen
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Hero Message */}
        {concept.hero_message && (
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-muted-foreground">Hero Message</h4>
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium">{concept.hero_message}</p>
            </div>
          </div>
        )}

        {/* Key Visual Direction */}
        {concept.key_visual_direction && (
          <div className="space-y-1">
            <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Image className="h-3.5 w-3.5" />
              Key Visual Richtung
            </h4>
            <p className="text-sm">{concept.key_visual_direction}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
