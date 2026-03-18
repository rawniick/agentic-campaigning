import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, MessageSquare, Image as ImageIcon, Target, Palette, FileText } from "lucide-react";
import type { Concept } from "@/types/database";

interface DraftConceptCardProps {
  concept: Concept;
}

// Grobkonzept-Anzeige: Positionierung, Kreativ-Richtung, Leitidee, Claims, Hero, Begruendung
export function DraftConceptCard({ concept }: DraftConceptCardProps) {
  const claims = concept.claims?.variants ?? [];
  const recommendedIndex = concept.recommended_claim_index ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">Grobkonzept</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Iteration {concept.iteration}</Badge>
            {concept.is_selected && (
              <Badge className="bg-green-600">Aktiv</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Positionierung */}
        {concept.positionierung && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Target className="h-4 w-4" />
              Positionierung
            </div>
            <p className="text-sm">{concept.positionierung}</p>
          </div>
        )}

        {/* Kreativ-Richtung */}
        {concept.kreativ_richtung && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Palette className="h-4 w-4" />
              Kreativ-Richtung
            </div>
            <p className="text-sm">{concept.kreativ_richtung}</p>
          </div>
        )}

        {/* Leitidee */}
        {concept.leitidee && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Lightbulb className="h-4 w-4" />
              Leitidee
            </div>
            <p className="text-lg font-medium">{concept.leitidee}</p>
          </div>
        )}

        {/* Claims */}
        {claims.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              Claims ({claims.length} Varianten)
            </div>
            <div className="space-y-1.5">
              {claims.map((claim, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-2 rounded-md p-2 text-sm ${
                    index === recommendedIndex
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-muted"
                  }`}
                >
                  <span className="text-muted-foreground font-mono text-xs mt-0.5">
                    {index + 1}.
                  </span>
                  <span className="flex-1">{claim}</span>
                  {index === recommendedIndex && (
                    <Badge variant="outline" className="text-xs">
                      Empfohlen
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hero Message */}
        {concept.hero_message && (
          <div className="space-y-1">
            <div className="text-sm font-medium text-muted-foreground">Hero Message</div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium">{concept.hero_message}</p>
            </div>
          </div>
        )}

        {/* Key Visual Direction */}
        {concept.key_visual_direction && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
              Key-Visual-Richtung
            </div>
            <p className="text-sm">{concept.key_visual_direction}</p>
          </div>
        )}

        {/* Begruendung */}
        {concept.begruendung && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              Begruendung
            </div>
            <p className="text-sm text-muted-foreground">{concept.begruendung}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
