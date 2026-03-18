"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FeedbackInput } from "./FeedbackInput";
import { approveStage, rejectStage, requestRevision } from "@/app/actions/approve";
import { toast } from "sonner";
import { CheckCircle, XCircle, RotateCcw, Loader2 } from "lucide-react";
import type { ApprovalStage } from "@/types/database";

interface ApprovalButtonProps {
  campaignId: string;
  stage: ApprovalStage;
  hasPendingApproval: boolean;
}

export function ApprovalButton({ campaignId, stage, hasPendingApproval }: ApprovalButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  if (!hasPendingApproval) return null;

  async function handleApprove() {
    setLoading("approve");
    const result = await approveStage(campaignId, stage);
    if (result.success) {
      toast.success("Genehmigt");
      router.refresh();
    } else {
      toast.error(result.error ?? "Fehler bei Genehmigung");
    }
    setLoading(null);
  }

  async function handleReject(feedback: string) {
    setLoading("reject");
    const result = await rejectStage(campaignId, stage, feedback || undefined);
    if (result.success) {
      toast.success("Abgelehnt");
      setRejectOpen(false);
      router.refresh();
    } else {
      toast.error(result.error ?? "Fehler bei Ablehnung");
    }
    setLoading(null);
  }

  async function handleRevision(feedback: string) {
    setLoading("revision");
    const result = await requestRevision(campaignId, stage, feedback);
    if (result.success) {
      toast.success("Ueberarbeitung angefragt");
      setRevisionOpen(false);
      router.refresh();
    } else {
      toast.error(result.error ?? "Fehler bei Ueberarbeitungsanfrage");
    }
    setLoading(null);
  }

  const stageLabel = stage === "concept" ? "Konzept" : stage === "translations" ? "Uebersetzungen" : "Assets";

  return (
    <div className="flex gap-2">
      {/* Genehmigen */}
      <Button onClick={handleApprove} disabled={loading !== null}>
        {loading === "approve" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle className="mr-2 h-4 w-4" />
        )}
        {stageLabel} genehmigen
      </Button>

      {/* Ueberarbeitung */}
      <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" disabled={loading !== null}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Ueberarbeitung
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ueberarbeitung anfragen</DialogTitle>
            <DialogDescription>
              Beschreibe was ueberarbeitet werden soll.
            </DialogDescription>
          </DialogHeader>
          <FeedbackInput onSubmit={handleRevision} required />
        </DialogContent>
      </Dialog>

      {/* Ablehnen */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" disabled={loading !== null}>
            <XCircle className="mr-2 h-4 w-4" />
            Ablehnen
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{stageLabel} ablehnen</DialogTitle>
            <DialogDescription>
              Begruendung fuer die Ablehnung (optional).
            </DialogDescription>
          </DialogHeader>
          <FeedbackInput onSubmit={handleReject} required={false} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
