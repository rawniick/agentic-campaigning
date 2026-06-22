import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db/server";
import { getDisclaimerById } from "@/lib/db/queries/disclaimers";
import { DisclaimerForm } from "../../DisclaimerForm";
import { updateDisclaimerAction } from "../../_actions";

export const dynamic = "force-dynamic";

export default async function EditDisclaimerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await getDisclaimerById(getDb(), id);
  if (!d) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-3xl font-bold">Disclaimer bearbeiten</h1>
      <p className="mb-6 text-sm text-muted-foreground">{d.slug}</p>

      <DisclaimerForm
        action={updateDisclaimerAction}
        initial={d}
        submitLabel="Speichern"
      />

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
