import Link from "next/link";
import { DisclaimerForm } from "../DisclaimerForm";
import { createDisclaimerAction } from "../_actions";

export const dynamic = "force-dynamic";

export default function NewDisclaimerPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-3xl font-bold">Neuer Disclaimer</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Pflichttext mit 4 Sprachen + optionalem Conditions-Match.
      </p>

      <DisclaimerForm action={createDisclaimerAction} submitLabel="Anlegen" />

      <div className="mt-8">
        <Link
          href="/admin/disclaimers"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Zurück zur Liste
        </Link>
      </div>
    </div>
  );
}
