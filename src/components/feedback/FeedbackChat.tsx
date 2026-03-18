"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Send, CheckCircle, User, Bot } from "lucide-react";
import { toast } from "sonner";
import type { FeedbackMessage, Concept } from "@/types/database";

interface FeedbackChatProps {
  campaignId: string;
  phase: "draft_concept" | "detail_concept";
  currentConcept: Concept;
  initialMessages: FeedbackMessage[];
  onConceptUpdate?: (concept: Concept) => void;
}

export function FeedbackChat({
  campaignId,
  phase,
  currentConcept,
  initialMessages,
  onConceptUpdate,
}: FeedbackChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<FeedbackMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [approving, setApproving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const phaseLabel = phase === "draft_concept" ? "Grobkonzept" : "Detailkonzept";

  // Auto-scroll bei neuen Nachrichten
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSendFeedback() {
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput("");
    setSending(true);

    // Optimistic: User-Message sofort anzeigen
    const tempUserMsg: FeedbackMessage = {
      id: `temp-${Date.now()}`,
      campaign_id: campaignId,
      phase,
      role: "user",
      content: userMessage,
      concept_snapshot: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, phase, message: userMessage }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error("Feedback fehlgeschlagen", { description: data.error });
        // Temporaere Nachricht entfernen
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
        setInput(userMessage);
        return;
      }

      // Assistant-Antwort hinzufuegen
      const assistantMsg: FeedbackMessage = {
        id: `assistant-${Date.now()}`,
        campaign_id: campaignId,
        phase,
        role: "assistant",
        content: data.message,
        concept_snapshot: data.updatedConcept,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Konzept-Update propagieren
      onConceptUpdate?.({
        ...currentConcept,
        leitidee: data.updatedConcept.leitidee,
        claims: {
          variants: data.updatedConcept.claims,
          recommended_index: data.updatedConcept.empfohlener_claim_index,
        },
        hero_message: data.updatedConcept.hero_message,
        iteration: data.iteration,
      });

      toast.success(`Iteration ${data.iteration}`, {
        description: `${data.changes.length} Aenderungen`,
      });
    } catch {
      toast.error("Netzwerkfehler");
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setInput(userMessage);
    } finally {
      setSending(false);
    }
  }

  async function handleApprove() {
    setApproving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/approve-phase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase, action: "approve" }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error("Freigabe fehlgeschlagen", { description: data.error });
        return;
      }

      toast.success(`${phaseLabel} freigegeben`);
      router.refresh();
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setApproving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendFeedback();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header mit Approve-Button */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h3 className="font-medium">Feedback-Dialog: {phaseLabel}</h3>
          <p className="text-sm text-muted-foreground">
            Iteration {currentConcept.iteration} &middot; {messages.length} Nachrichten
          </p>
        </div>
        <Button
          onClick={handleApprove}
          disabled={approving || sending}
          className="bg-green-600 hover:bg-green-700"
        >
          {approving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Freigeben
        </Button>
      </div>

      {/* Chat-Nachrichten */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-[300px] max-h-[500px]">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Gib Feedback um das {phaseLabel} zu verfeinern. Wenn du zufrieden bist, klicke &quot;Freigeben&quot;.
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="flex-shrink-0 mt-1">
                <Bot className="h-6 w-6 text-blue-500" />
              </div>
            )}
            <Card className={`max-w-[80%] ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              <CardContent className="p-3">
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.concept_snapshot && msg.role === "assistant" && (
                  <details className="mt-2 pt-2 border-t border-border/50">
                    <summary className="text-xs cursor-pointer opacity-70 hover:opacity-100">
                      Aktualisiertes Konzept anzeigen
                    </summary>
                    <pre className="text-xs mt-1 overflow-x-auto">
                      {JSON.stringify(msg.concept_snapshot, null, 2)}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
            {msg.role === "user" && (
              <div className="flex-shrink-0 mt-1">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex gap-3">
            <Bot className="h-6 w-6 text-blue-500 flex-shrink-0 mt-1" />
            <Card className="bg-muted">
              <CardContent className="p-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">AI denkt nach...</span>
              </CardContent>
            </Card>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="pt-4 border-t flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Feedback zum ${phaseLabel} eingeben...`}
          disabled={sending}
          rows={2}
          className="resize-none"
        />
        <Button
          onClick={handleSendFeedback}
          disabled={!input.trim() || sending}
          size="icon"
          className="flex-shrink-0 self-end"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
