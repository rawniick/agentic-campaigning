// Canva Template Mappings — CRUD fuer Template→Channel/Format Zuordnungen

import { getServerClient } from "@/lib/db/supabase";

export interface CanvaTemplateMapping {
  id: string;
  brand: string;
  canva_template_id: string;
  canva_template_name: string | null;
  channel: string;
  format: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Alle Mappings fuer einen Brand laden
export async function getMappingsByBrand(brand: string): Promise<CanvaTemplateMapping[]> {
  const db = await getServerClient();
  const { data, error } = await db
    .from("canva_template_mappings")
    .select("*")
    .eq("brand", brand)
    .eq("is_active", true)
    .order("channel", { ascending: true });

  if (error) throw new Error(`Mappings laden fehlgeschlagen: ${error.message}`);
  return (data ?? []) as CanvaTemplateMapping[];
}

// Mapping fuer spezifischen Channel/Format holen
export async function getMappingForSlot(
  brand: string,
  channel: string,
  format: string
): Promise<CanvaTemplateMapping | null> {
  const db = await getServerClient();
  const { data, error } = await db
    .from("canva_template_mappings")
    .select("*")
    .eq("brand", brand)
    .eq("channel", channel)
    .eq("format", format)
    .eq("is_active", true)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Mapping laden fehlgeschlagen: ${error.message}`);
  }
  return (data as CanvaTemplateMapping) ?? null;
}

// Mapping erstellen oder updaten (Upsert)
export async function upsertMapping(mapping: {
  brand: string;
  canva_template_id: string;
  canva_template_name: string | null;
  channel: string;
  format: string;
}): Promise<CanvaTemplateMapping> {
  const db = await getServerClient();
  const { data, error } = await db
    .from("canva_template_mappings")
    .upsert(
      {
        brand: mapping.brand,
        canva_template_id: mapping.canva_template_id,
        canva_template_name: mapping.canva_template_name,
        channel: mapping.channel,
        format: mapping.format,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "brand,channel,format" }
    )
    .select()
    .single();

  if (error) throw new Error(`Mapping speichern fehlgeschlagen: ${error.message}`);
  return data as CanvaTemplateMapping;
}

// Mapping loeschen (soft delete)
export async function deleteMapping(brand: string, channel: string, format: string): Promise<void> {
  const db = await getServerClient();
  const { error } = await db
    .from("canva_template_mappings")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("brand", brand)
    .eq("channel", channel)
    .eq("format", format);

  if (error) throw new Error(`Mapping loeschen fehlgeschlagen: ${error.message}`);
}

// Alle Mappings fuer einen Brand auf einmal setzen (Bulk)
export async function bulkUpsertMappings(
  brand: string,
  mappings: { canva_template_id: string; canva_template_name: string | null; channel: string; format: string }[]
): Promise<CanvaTemplateMapping[]> {
  const db = await getServerClient();
  const rows = mappings.map((m) => ({
    brand,
    canva_template_id: m.canva_template_id,
    canva_template_name: m.canva_template_name,
    channel: m.channel,
    format: m.format,
    is_active: true,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await db
    .from("canva_template_mappings")
    .upsert(rows, { onConflict: "brand,channel,format" })
    .select();

  if (error) throw new Error(`Bulk-Mapping fehlgeschlagen: ${error.message}`);
  return (data ?? []) as CanvaTemplateMapping[];
}
