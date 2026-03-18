import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type { Translation } from "@/types/database";

interface TranslationViewProps {
  translations: Translation[];
  sourceClaims?: string[];
  sourceHeroMessage?: string;
}

const LANG_LABELS: Record<string, string> = {
  fr: "Franzoesisch",
  it: "Italienisch",
  en: "Englisch",
};

export function TranslationView({
  translations,
  sourceClaims = [],
  sourceHeroMessage,
}: TranslationViewProps) {
  if (translations.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Uebersetzungen vorhanden.</p>;
  }

  return (
    <div className="space-y-6">
      {translations.map((t) => (
        <Card key={t.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                DE → {t.target_language.toUpperCase()} ({LANG_LABELS[t.target_language] ?? t.target_language})
              </CardTitle>
              <div className="flex gap-2">
                <Badge variant={t.approval_status === "approved" ? "default" : "outline"}>
                  {t.approval_status}
                </Badge>
                {t.quality_confidence && (
                  <Badge variant="secondary">{t.quality_confidence}</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Claims side-by-side */}
            {t.translated_claims && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Claims</h4>
                <div className="space-y-1">
                  {t.translated_claims.variants.map((claim, i) => (
                    <div key={i} className="grid grid-cols-2 gap-4 rounded-md p-2 text-sm odd:bg-muted">
                      <span className="text-muted-foreground">{sourceClaims[i] ?? "—"}</span>
                      <span>{claim}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hero Message side-by-side */}
            {t.translated_hero_message && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Hero Message</h4>
                <div className="grid grid-cols-2 gap-4 rounded-md bg-muted p-3 text-sm">
                  <span className="text-muted-foreground">{sourceHeroMessage ?? "—"}</span>
                  <span className="font-medium">{t.translated_hero_message}</span>
                </div>
              </div>
            )}

            {/* Glossar-Begriffe hervorheben */}
            {t.glossar_terms_used && t.glossar_terms_used.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Glossar-Begriffe verwendet</h4>
                <div className="flex flex-wrap gap-1">
                  {t.glossar_terms_used.map((term, i) => {
                    const entries = Object.entries(term);
                    return entries.map(([key, val]) => (
                      <Badge key={`${i}-${key}`} variant="outline" className="text-xs">
                        {key}: {val}
                      </Badge>
                    ));
                  })}
                </div>
              </div>
            )}

            {/* CharLimit-Warnungen */}
            {t.char_limit_warnings && t.char_limit_warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-1 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Zeichenlimit-Warnungen
                </h4>
                <ul className="space-y-1 text-sm">
                  {t.char_limit_warnings.map((w, i) => (
                    <li key={i} className="rounded-md bg-destructive/10 p-2">
                      <span className="font-mono text-xs">{w.field}</span>: {w.actual}/{w.limit} Zeichen
                      <br />
                      <span className="text-muted-foreground">{w.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
