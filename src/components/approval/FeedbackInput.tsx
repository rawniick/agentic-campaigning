"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Send } from "lucide-react";

interface FeedbackInputProps {
  onSubmit: (feedback: string) => void | Promise<void>;
  placeholder?: string;
  required?: boolean;
}

export function FeedbackInput({
  onSubmit,
  placeholder = "Feedback eingeben...",
  required = true,
}: FeedbackInputProps) {
  const [feedback, setFeedback] = useState("");

  return (
    <div className="space-y-3">
      <Label>Feedback</Label>
      <Textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder={placeholder}
        rows={3}
      />
      <Button
        onClick={() => onSubmit(feedback)}
        disabled={required && !feedback.trim()}
        size="sm"
      >
        <Send className="mr-2 h-3.5 w-3.5" />
        Absenden
      </Button>
    </div>
  );
}
