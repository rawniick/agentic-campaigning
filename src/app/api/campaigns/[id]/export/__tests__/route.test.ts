// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from "vitest";

// DB + ZIP-Builder mocken: wir testen nur die Route-Logik (Validierung,
// Fehler-Maskierung, Header) deterministisch, ohne echte Supabase/Storage.
vi.mock("@/lib/db/server", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/lib/export/exportCampaignZip", () => ({
  exportCampaignZip: vi.fn(),
}));

import { GET } from "../route";
import { exportCampaignZip } from "@/lib/export/exportCampaignZip";

const zipMock = exportCampaignZip as unknown as ReturnType<typeof vi.fn>;
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
