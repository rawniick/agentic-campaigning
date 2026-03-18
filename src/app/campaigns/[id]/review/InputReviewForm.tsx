"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface InputReviewFormProps {
  campaignId: string;
}

export function InputReviewForm({ campaignId }: InputReviewFormProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    setConfirming(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/confirm-input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error("Bestaetigung fehlgeschlagen", { description: data.error });
        return;
      }

      toast.success("Eingabe bestaetigt");
      router.push(`/campaigns/${campaignId}`);
      router.refresh();
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="flex justify-end gap-3">
      <Button variant="outline" onClick={() => router.push(`/campaigns/${campaignId}`)}>
        Zurueck zur Kampagne
      </Button>
      <Button onClick={handleConfirm} disabled={confirming}>
        {confirming ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle className="mr-2 h-4 w-4" />
        )}
        Bestaetigen & weiter
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
