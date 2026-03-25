import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import {
  listBases,
  listTables,
  AirtableError,
  type AirtableConfig,
} from "@/lib/integrations/airtable";

// POST /api/brand-brain/airtable/test-connection
// Testet die Airtable-Verbindung mit Token + Base ID
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  let token: string;
  let baseId: string;

  try {
    const body = (await request.json()) as {
      token: string;
      baseId: string;
    };
    token = body.token;
    baseId = body.baseId;
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request Body" },
      { status: 400 }
    );
  }

  if (!token) {
    return NextResponse.json(
      { error: "Personal Access Token ist erforderlich" },
      { status: 400 }
    );
  }

  try {
    // 1. Bases abrufen (benoetigt schema.bases:read Scope)
    let bases: Array<{ id: string; name: string; permissionLevel: string }> = [];
    try {
      bases = await listBases(token);
    } catch (err) {
      // Meta API Zugriff nicht vorhanden — kein Fehler, nur kein Discovery
      if (err instanceof AirtableError && err.code === "UNAUTHENTICATED") {
        throw err; // Token ungueltig
      }
      // Andere Fehler (z.B. kein Meta API Scope) — wir machen weiter mit dem baseId
    }

    // 2. Tables der ausgewaehlten Base laden
    let tables: Array<{ id: string; name: string; fields: Array<{ name: string; type: string }> }> = [];
    const targetBaseId = baseId || (bases.length > 0 ? bases[0].id : "");

    if (targetBaseId) {
      try {
        tables = (await listTables(token, targetBaseId)).map((t) => ({
          id: t.id,
          name: t.name,
          fields: t.fields.map((f) => ({ name: f.name, type: f.type })),
        }));
      } catch (err) {
        if (err instanceof AirtableError && err.code === "UNAUTHENTICATED") {
          throw err;
        }
        // Meta API kein Zugriff — trotzdem Erfolg melden
      }
    }

    // 3. Auto-Suggest Table-Mappings basierend auf Table-Namen
    const suggestedMappings: Record<string, string> = {};
    const mappingPatterns: Record<string, RegExp> = {
      toneOfVoice: /tone\s*of\s*voice|tonali(ty|taet|tät)|sprach(e|regeln)|brand\s*voice|tov/i,
      ciRules: /ci[-\s]?rules?|corporate\s*identity|design\s*system|visual/i,
      glossar: /gloss?ar|terminolog(ie|y)|wording|begriffe/i,
      goldenExamples: /golden\s*example|beispiel|example|referenz|reference/i,
    };

    for (const table of tables) {
      for (const [key, pattern] of Object.entries(mappingPatterns)) {
        if (pattern.test(table.name) && !suggestedMappings[key]) {
          suggestedMappings[key] = table.name;
        }
      }
    }

    return NextResponse.json({
      success: true,
      bases: bases.map((b) => ({ id: b.id, name: b.name })),
      selectedBase: targetBaseId,
      tables: tables.map((t) => ({
        id: t.id,
        name: t.name,
        fieldCount: t.fields.length,
        fields: t.fields.slice(0, 10), // Nur erste 10 Felder
      })),
      suggestedMappings,
    });
  } catch (err) {
    if (err instanceof AirtableError) {
      return NextResponse.json({
        success: false,
        error: `Airtable ${err.code}: ${err.message}`,
      });
    }
    return NextResponse.json({
      success: false,
      error: `Verbindung fehlgeschlagen: ${String(err)}`,
    });
  }
}
