import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { getMappingsByBrand, upsertMapping, deleteMapping, bulkUpsertMappings } from "@/lib/db/queries/canva-mappings";

// GET /api/integrations/canva/mappings — Gespeicherte Template-Zuordnungen laden
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

  const brand = request.nextUrl.searchParams.get("brand") ?? "default";

  try {
    const mappings = await getMappingsByBrand(brand);
    return NextResponse.json({ mappings, brand });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mappings laden fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/integrations/canva/mappings — Template-Zuordnung speichern
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

  const body = await request.json();

  // Bulk-Modus: Array von Mappings
  if (Array.isArray(body.mappings)) {
    const brand = body.brand ?? "default";
    try {
      const results = await bulkUpsertMappings(brand, body.mappings);
      return NextResponse.json({ mappings: results });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bulk-Mapping fehlgeschlagen";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Einzel-Modus
  const { brand, canva_template_id, canva_template_name, channel, format } = body as {
    brand?: string;
    canva_template_id: string;
    canva_template_name?: string;
    channel: string;
    format: string;
  };

  if (!canva_template_id || !channel || !format) {
    return NextResponse.json(
      { error: "canva_template_id, channel und format sind Pflicht" },
      { status: 400 }
    );
  }

  try {
    const mapping = await upsertMapping({
      brand: brand ?? "default",
      canva_template_id,
      canva_template_name: canva_template_name ?? null,
      channel,
      format,
    });
    return NextResponse.json({ mapping });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mapping speichern fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/integrations/canva/mappings — Template-Zuordnung loeschen
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

  const { brand, channel, format } = await request.json();

  if (!channel || !format) {
    return NextResponse.json({ error: "channel und format sind Pflicht" }, { status: 400 });
  }

  try {
    await deleteMapping(brand ?? "default", channel, format);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mapping loeschen fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
