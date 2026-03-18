import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import {
  fetchBrands,
  discoverPageMappings,
  type FrontifyConfig,
  FrontifyError,
} from "@/lib/integrations/frontify";

// POST /api/brand-brain/frontify/test-connection
// Testet die Frontify-Verbindung mit Domain + Token
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  let domain: string;
  let token: string;
  let brandId: string | undefined;

  try {
    const body = (await request.json()) as {
      domain: string;
      token: string;
      brandId?: string;
    };
    domain = body.domain;
    token = body.token;
    brandId = body.brandId || undefined;
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request Body" },
      { status: 400 }
    );
  }

  if (!domain || !token) {
    return NextResponse.json(
      { error: "Domain und Token sind erforderlich" },
      { status: 400 }
    );
  }

  // Domain normalisieren (ohne https://)
  const normalizedDomain = domain
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  const config: FrontifyConfig = {
    domain: normalizedDomain,
    token,
    brandId,
  };

  try {
    // 1. Brands abrufen
    const brands = await fetchBrands(config);
    if (brands.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Keine Brands gefunden. Bitte Token-Berechtigungen pruefen.",
      });
    }

    // 2. Page Mappings discoveren
    const testConfig: FrontifyConfig = {
      ...config,
      brandId: brandId || brands[0].id,
    };
    const mappings = await discoverPageMappings(testConfig);

    return NextResponse.json({
      success: true,
      brands: brands.map((b) => ({ id: b.id, name: b.name })),
      mappings: mappings.map((m) => ({
        pageId: m.pageId,
        pageTitle: m.pageTitle,
        mappedTo: m.mappedTo,
      })),
      selectedBrand: testConfig.brandId,
    });
  } catch (err) {
    if (err instanceof FrontifyError) {
      return NextResponse.json({
        success: false,
        error: `Frontify ${err.code}: ${err.message}`,
      });
    }
    return NextResponse.json({
      success: false,
      error: `Verbindung fehlgeschlagen: ${String(err)}`,
    });
  }
}
