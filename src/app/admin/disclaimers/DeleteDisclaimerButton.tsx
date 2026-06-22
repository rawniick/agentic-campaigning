"use client";

import { Button } from "@/components/ui/button";

// Bestaetigung vor dem (irreversiblen) Loeschen eines Compliance-Disclaimers —
// verhindert Fehlklick auf den Button neben "Bearbeiten".
export function DeleteDisclaimerButton({ slug }: { slug: string }) {
  return (
    <Button
      size="sm"
      variant="outline"
      type="submit"
      onClick={(e) => {
        if (!confirm(`Disclaimer "${slug}" wirklich loeschen?`)) {
          e.preventDefault();
        }
      }}
    >
      Loeschen
    </Button>
  );
}
