"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  generateHeroAction,
  uploadHeroReferencesAction,
  selectGeneratedHeroGateAction,
  type HeroCandidateView,
} from "../_gate-actions";
import { ProgressBar } from "./ProgressBar";

interface HeroChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  campaignId: string;
  initialHistory: HeroChatTurn[];
  initialCandidates: HeroCandidateView[];
  initialPrompt: string;
}

// Gate-2 AI-Hero-Gen: Prompt + Komponenten-Referenzen -> nano-banana erzeugt 3
// freigestellte Kandidaten; chat-iteriert (gewaehlte Variante = Referenz fuer den
// naechsten Turn). Aenderung am Bild IMMER via Re-Gen, nie per Drag.
export function HeroGenPanel({
  campaignId,
  initialHistory,
  initialCandidates,
  initialPrompt,
}: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [candidates, setCandidates] =
    useState<HeroCandidateView[]>(initialCandidates);
  const [history, setHistory] = useState<HeroChatTurn[]>(initialHistory);
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const hasCandidates = candidates.length > 0;

  function handleUploadRefs() {
    const input = fileRef.current;
    if (!input?.files || input.files.length === 0 || isPending) return;
    setError(null);
    const fd = new FormData();
    fd.set("campaignId", campaignId);
    Array.from(input.files).forEach((f) => fd.append("refs", f));
    startTransition(async () => {
      try {
        const { urls } = await uploadHeroReferencesAction(fd);
        setReferenceUrls((prev) => [...prev, ...urls]);
        if (fileRef.current) fileRef.current.value = "";
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload fehlgeschlagen");
      }
    });
  }

  function handleGenerate() {
    const p = prompt.trim();
    if (!p || isPending) return;
    setError(null);
    setHistory((prev) => [...prev, { role: "user", content: p }]);
    startTransition(async () => {
      try {
        const r = await generateHeroAction({
          campaignId,
          basePrompt: p,
          referenceUrls,
        });
        setHistory((prev) => [
          ...prev,
          { role: "assistant", content: r.rationale },
        ]);
        setCandidates(r.candidates);
        setSelectedIdx(null);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Generierung fehlgeschlagen — ist FAL_KEY gesetzt?"
        );
      }
    });
  }

  function handleRefine() {
    const msg = feedback.trim();
    if (!msg || isPending) return;
    setError(null);
    const selectedRef =
      selectedIdx !== null ? candidates[selectedIdx]?.storage_url : undefined;
    setHistory((prev) => [...prev, { role: "user", content: msg }]);
    setFeedback("");
    startTransition(async () => {
      try {
        const r = await generateHeroAction({
          campaignId,
          currentPrompt: prompt,
          userMessage: msg,
          referenceUrls,
          selectedReferenceUrl: selectedRef,
        });
        setHistory((prev) => [
          ...prev,
          { role: "assistant", content: r.rationale },
        ]);
        setPrompt(r.prompt);
        setCandidates(r.candidates);
        setSelectedIdx(null);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Verfeinerung fehlgeschlagen"
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Dialog-Verlauf (Prompt-Iterationen) */}
      {history.length > 0 && (
        <div className="max-h-40 space-y-2 overflow-y-auto">
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
      )}

      {/* Prompt + Referenzen + Generieren */}
      <div className="space-y-3 rounded-md border bg-card p-3">
        <div className="space-y-2">
          <Label htmlFor="hero-prompt">Bild-Prompt</Label>
          <Textarea
            id="hero-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="z.B. „Junge Familie lacht, freigestellt, sommerliches Tageslicht“"
            rows={2}
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hero-refs">
            Referenzbilder (optional, mehrere) — Komponenten/Stil-Vorlagen
          </Label>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              id="hero-refs"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="border-input bg-background h-10 w-full rounded-md border px-3 py-2 text-sm"
              disabled={isPending}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUploadRefs}
              disabled={isPending}
            >
              Hochladen
            </Button>
          </div>
          {referenceUrls.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {referenceUrls.length} Referenz(en) hochgeladen — fliessen in die
              Generierung ein.
            </p>
          )}
        </div>

        <Button
          type="button"
          onClick={handleGenerate}
          disabled={isPending || prompt.trim().length === 0}
        >
          {isPending ? "Generiere …" : hasCandidates ? "Neu generieren" : "Generieren"}
        </Button>
      </div>

      <ProgressBar active={isPending} label="nano-banana erzeugt Kandidaten…" />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* Kandidaten-Grid: picken + iterieren */}
      {hasCandidates && (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Kandidaten — wähle einen
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {candidates.map((c, i) => (
              <button
                key={c.storage_url}
                type="button"
                onClick={() => setSelectedIdx(i)}
                className={`overflow-hidden rounded-md border p-1 text-left ${
                  selectedIdx === i
                    ? "border-primary ring-2 ring-primary"
                    : "border-input"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.storage_url}
                  alt={`Kandidat ${i + 1}`}
                  className="h-32 w-full rounded bg-muted object-cover"
                />
                <div className="mt-1 flex items-center justify-between px-1">
                  <span className="text-xs text-muted-foreground">
                    #{i + 1}
                  </span>
                  {c.qaScore !== null && (
                    <span className="rounded bg-foreground/80 px-1.5 py-0.5 text-[10px] font-medium text-background">
                      QA {Math.round(c.qaScore * 100)}%
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {selectedIdx !== null && (
            <div className="space-y-3 rounded-md border-t pt-3">
              <form action={selectGeneratedHeroGateAction}>
                <input type="hidden" name="campaignId" value={campaignId} />
                <input
                  type="hidden"
                  name="storageUrl"
                  value={candidates[selectedIdx].storage_url}
                />
                <Button type="submit" disabled={isPending}>
                  Diesen Hero wählen → Layout
                </Button>
              </form>

              <div className="space-y-2">
                <Label htmlFor="hero-feedback">
                  Oder verfeinern (gewählte Variante = Referenz)
                </Label>
                <Textarea
                  id="hero-feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleRefine();
                    }
                  }}
                  placeholder="z.B. „wärmeres Licht“, „mehr Bewegung“, „anderer Bildausschnitt“"
                  rows={2}
                  disabled={isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRefine}
                  disabled={isPending || feedback.trim().length === 0}
                >
                  Verfeinern
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
