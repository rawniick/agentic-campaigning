"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CopyOutput } from "@/lib/copy/generateCopy";
import {
  refineCopyChatAction,
  applyCopyCandidatesAction,
} from "../_chat-actions";
import { ProgressBar } from "./ProgressBar";

// Ein Dialog-Turn im Krea-Chat. User-Turns tragen reines Feedback,
// Assistant-Turns die Begruendung + das erzeugte Kandidaten-Set.
interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  candidates: CopyOutput | null;
}

interface Props {
  campaignId: string;
  initialHistory: ChatTurn[];
  currentCandidates: CopyOutput;
}

export function CopyChatPanel({
  campaignId,
  initialHistory,
  currentCandidates,
}: Props) {
  // Lokaler Verlauf: startet bei der vom Server gelieferten History und waechst
  // bei jedem Refine-Roundtrip (User-Feedback + Assistant-Begruendung).
  const [history, setHistory] = useState<ChatTurn[]>(initialHistory);
  // Der aktuell gezeigte Kandidaten-Stand (3 Headlines + Subline + CTA).
  const [candidates, setCandidates] = useState<CopyOutput>(currentCandidates);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  // "Gespeichert"-Hinweis nach erfolgreichem Uebernehmen eines Kandidaten-Sets.
  const [appliedIdx, setAppliedIdx] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    const userMessage = message.trim();
    if (!userMessage || isPending) return;
    setError(null);

    // Optimistisch das User-Feedback anzeigen, damit der Chat nicht "haengt".
    setHistory((prev) => [
      ...prev,
      { role: "user", content: userMessage, candidates: null },
    ]);
    setMessage("");

    startTransition(async () => {
      try {
        const result = await refineCopyChatAction({ campaignId, userMessage });
        setHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.rationale,
            candidates: result.candidates,
          },
        ]);
        setCandidates(result.candidates);
        setAppliedIdx(null);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Refine fehlgeschlagen — nochmal?"
        );
      }
    });
  }

  // Uebernimmt das aktuelle Set, schiebt aber die gewaehlte Headline an Position 0
  // (sie wird beim Gate-Approve als Default vorausgewaehlt).
  function handleApply(idx: number) {
    if (isPending) return;
    setError(null);

    const reordered = [
      candidates.headlines[idx],
      ...candidates.headlines.filter((_, i) => i !== idx),
    ];
    const payload: CopyOutput = {
      headlines: reordered,
      subline: candidates.subline,
      cta_label: candidates.cta_label,
    };

    startTransition(async () => {
      try {
        await applyCopyCandidatesAction({ campaignId, candidates: payload });
        setCandidates(payload);
        setAppliedIdx(idx);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Uebernehmen fehlgeschlagen — nochmal?"
        );
      }
    });
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Dialog-Verlauf */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {history.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Noch kein Feedback. Schreib unten, was an der Copy anders sein soll
            (z.B. &bdquo;kuerzer&ldquo;, &bdquo;mehr Dringlichkeit&ldquo;,
            &bdquo;Du-Ansprache&ldquo;).
          </p>
        )}
        {history.map((turn, i) => (
          <div
            key={i}
            className={
              turn.role === "user"
                ? "ml-8 rounded-md bg-primary/10 px-3 py-2 text-sm"
                : "mr-8 rounded-md bg-muted px-3 py-2 text-sm"
            }
          >
            <div className="mb-1 text-xs font-semibold text-muted-foreground">
              {turn.role === "user" ? "Du" : "Claude"}
            </div>
            <div className="whitespace-pre-wrap">{turn.content}</div>
          </div>
        ))}
      </div>

      {/* Aktuelle Kandidaten: 3 Headlines + Subline + CTA */}
      <div className="space-y-2 rounded-md border bg-card p-3">
        <div className="text-xs font-semibold text-muted-foreground">
          Aktuelle Kandidaten
        </div>
        <div className="space-y-2">
          {candidates.headlines.map((h, i) => (
            <div
              key={i}
              className={`flex items-start justify-between gap-3 rounded-md border p-2 ${
                appliedIdx === i ? "border-primary bg-primary/5" : "border-input"
              }`}
            >
              <span className="text-sm">{h}</span>
              <Button
                type="button"
                size="sm"
                variant={appliedIdx === i ? "default" : "outline"}
                disabled={isPending}
                onClick={() => handleApply(i)}
              >
                {appliedIdx === i ? "✓ uebernommen" : "uebernehmen"}
              </Button>
            </div>
          ))}
        </div>
        <div className="rounded-md bg-muted p-2 text-xs">
          <div>
            <strong>Subline:</strong> {candidates.subline}
          </div>
          <div>
            <strong>CTA:</strong> {candidates.cta_label}
          </div>
        </div>
      </div>

      {/* Pending-Indikator: zeigt, dass Claude denkt (haengt nicht). */}
      <ProgressBar active={isPending} label="Claude denkt…" />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* Eingabe + Senden */}
      <div className="space-y-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            // Enter sendet, Shift+Enter macht einen Zeilenumbruch.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Feedback an Claude … (Enter sendet, Shift+Enter = Zeilenumbruch)"
          rows={2}
          disabled={isPending}
        />
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || message.trim().length === 0}
        >
          {isPending ? "Sende …" : "Senden"}
        </Button>
      </div>
    </div>
  );
}
