import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ChannelAdaptations } from "@/types/database";

interface ChannelPreviewProps {
  adaptations: ChannelAdaptations;
}

export function ChannelPreview({ adaptations }: ChannelPreviewProps) {
  const channels = Object.entries(adaptations).filter(([, v]) => v !== undefined && v !== null);

  if (channels.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Kanaladaptionen vorhanden.</p>;
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">Kanaladaptionen</h4>
      <Tabs defaultValue={channels[0][0]}>
        <TabsList>
          {channels.map(([key]) => (
            <TabsTrigger key={key} value={key} className="capitalize">
              {key}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Social */}
        {adaptations.social && (
          <TabsContent value="social">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Social Media</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="font-semibold">{adaptations.social.hook}</p>
                  <p className="text-sm">{adaptations.social.body}</p>
                  <p className="text-sm font-medium text-primary">{adaptations.social.cta}</p>
                  <div className="flex gap-1 pt-1">
                    {adaptations.social.hashtags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* CRM */}
        {adaptations.crm && (
          <TabsContent value="crm">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">CRM / Newsletter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{adaptations.crm.subject_line}</p>
                    <CharCount text={adaptations.crm.subject_line} limit={50} />
                  </div>
                  <p className="text-xs text-muted-foreground">{adaptations.crm.preview_text}</p>
                  <hr />
                  <p className="font-medium">{adaptations.crm.headline}</p>
                  <p className="text-sm">{adaptations.crm.body}</p>
                  <p className="text-sm font-medium text-primary">{adaptations.crm.cta}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Website */}
        {adaptations.website && (
          <TabsContent value="website">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Website</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border p-6 text-center space-y-2">
                  <h2 className="text-2xl font-bold">{adaptations.website.hero_headline}</h2>
                  <p className="text-muted-foreground">{adaptations.website.hero_subline}</p>
                  <div className="flex justify-center gap-2 pt-2">
                    <span className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
                      {adaptations.website.cta_primary}
                    </span>
                    {adaptations.website.cta_secondary && (
                      <span className="rounded-md border px-4 py-2 text-sm">
                        {adaptations.website.cta_secondary}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* SEA */}
        {adaptations.sea && (
          <TabsContent value="sea">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">SEA (Google/Bing Ads)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Headlines (max 30 Zeichen)</p>
                  {adaptations.sea.headlines.map((h, i) => (
                    <div key={i} className="flex items-center justify-between rounded border px-3 py-1.5 text-sm">
                      <span>{h}</span>
                      <CharCount text={h} limit={30} />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Descriptions (max 90 Zeichen)</p>
                  {adaptations.sea.descriptions.map((d, i) => (
                    <div key={i} className="flex items-center justify-between rounded border px-3 py-1.5 text-sm">
                      <span>{d}</span>
                      <CharCount text={d} limit={90} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Print */}
        {adaptations.print && (
          <TabsContent value="print">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Print</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border p-6 space-y-3">
                  <h2 className="text-xl font-bold">{adaptations.print.headline}</h2>
                  <p className="text-muted-foreground">{adaptations.print.subline}</p>
                  <p className="text-sm">{adaptations.print.body}</p>
                  <hr />
                  <p className="text-xs text-muted-foreground">{adaptations.print.pflichttext}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// Zeichenzaehler mit Farbindikator
function CharCount({ text, limit }: { text: string; limit: number }) {
  const count = text.length;
  const over = count > limit;
  return (
    <span className={`text-xs font-mono ${over ? "text-destructive font-bold" : "text-muted-foreground"}`}>
      {count}/{limit}
    </span>
  );
}
