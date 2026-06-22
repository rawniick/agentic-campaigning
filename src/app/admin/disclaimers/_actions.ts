"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/server";
import { getActiveBrandConfig } from "@/lib/brand/server";
import {
  createDisclaimer,
  updateDisclaimer,
  deleteDisclaimer,
  getDisclaimerById,
} from "@/lib/db/queries/disclaimers";
import { parseDisclaimerForm } from "@/lib/admin/disclaimerForm";

const idSchema = z.string().uuid();

function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string }).code;
  return code === "23505" || /unique|duplicate/i.test(String((e as Error)?.message));
}

// Stellt sicher, dass der Disclaimer zur AKTIVEN Brand gehoert — kein Zugriff per
// fremder id (cross-brand IDOR). brand_id ist ueberall durchgezogen (multi-brand-ready).
async function requireOwnDisclaimer(id: string, brandId: string): Promise<void> {
  const existing = await getDisclaimerById(getDb(), id);
  if (!existing || existing.brand_id !== brandId) {
    throw new Error("Disclaimer nicht gefunden");
  }
}

export async function createDisclaimerAction(formData: FormData) {
  const values = parseDisclaimerForm(Object.fromEntries(formData));
  const brand = await getActiveBrandConfig();
  try {
    await createDisclaimer(getDb(), { brand_id: brand.brand.id, ...values });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new Error(`Slug "${values.slug}" ist fuer diese Brand bereits vergeben.`);
    }
    throw e;
  }
  revalidatePath("/admin/disclaimers");
  redirect("/admin/disclaimers");
}

export async function updateDisclaimerAction(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const values = parseDisclaimerForm(Object.fromEntries(formData));
  const brand = await getActiveBrandConfig();
  await requireOwnDisclaimer(id, brand.brand.id);
  try {
    await updateDisclaimer(getDb(), id, values);
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new Error(`Slug "${values.slug}" ist fuer diese Brand bereits vergeben.`);
    }
    throw e;
  }
  revalidatePath("/admin/disclaimers");
  redirect("/admin/disclaimers");
}

export async function deleteDisclaimerAction(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const brand = await getActiveBrandConfig();
  await requireOwnDisclaimer(id, brand.brand.id);
  await deleteDisclaimer(getDb(), id);
  revalidatePath("/admin/disclaimers");
}
