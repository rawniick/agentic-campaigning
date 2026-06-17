// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from "vitest";

// DB + ZIP-Builder mocken: wir testen nur die Route-Logik (Validierung,
// Fehler-Maskierung, Header) deterministisch, ohne echte Supabase/Storage.
vi.mock("@/lib/db/server", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/lib/auth/get-user", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/export/exportCampaignZip", () => ({
  exportCampaignZip: vi.fn(),
  EmptyExportError: class EmptyExportError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "EmptyExportError";
    }
  },
}));

import { GET } from "../route";
import {
  exportCampaignZip,
  EmptyExportError,
} from "@/lib/export/exportCampaignZip";
import { getAuthUser } from "@/lib/auth/get-user";

const zipMock = exportCampaignZip as unknown as ReturnType<typeof vi.fn>;
const authMock = getAuthUser as unknown as ReturnType<typeof vi.fn>;
const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function call(id: string) {
  return GET(new Request("http://localhost/api/campaigns/x/export"), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/campaigns/[id]/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Standard: eingeloggter User — einzelne Tests ueberschreiben das.
    authMock.mockResolvedValue({ id: "user-1" });
  });

  it("returns 401 when there is no authenticated user", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await call(VALID_UUID);
    expect(res.status).toBe(401);
    expect(zipMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-uuid id and never hits the export", async () => {
    const res = await call("not-a-uuid");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Ungueltige/);
    expect(zipMock).not.toHaveBeenCalled();
  });

  it("returns a generic 500 without leaking internal error details", async () => {
    zipMock.mockRejectedValueOnce(
      new Error("invalid input syntax for type uuid: secret-host:5432")
    );
    const res = await call(VALID_UUID);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("ZIP-Export fehlgeschlagen");
    expect(body.details).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("secret-host");
  });

  it("returns 422 with a clear message when there is nothing to export", async () => {
    zipMock.mockRejectedValueOnce(
      new EmptyExportError(
        "Keine exportierbaren Assets — alle brand-nicht-konform. Siehe Gallery."
      )
    );
    const res = await call(VALID_UUID);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/Keine exportierbaren Assets/);
  });

  it("returns the zip with a filename on success", async () => {
    zipMock.mockResolvedValueOnce(Buffer.from("ZIPDATA"));
    const res = await call(VALID_UUID);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toContain(
      `${VALID_UUID}.zip`
    );
  });
});
