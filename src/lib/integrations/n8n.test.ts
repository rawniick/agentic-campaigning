import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildN8nConfig, computeResumeUrl, resumeN8nWait } from "./n8n";
import type { N8nConfig } from "./n8n";

describe("buildN8nConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("gibt null wenn N8N_WEBHOOK_URL fehlt", () => {
    delete process.env.N8N_WEBHOOK_URL;
    delete process.env.N8N_API_KEY;
    expect(buildN8nConfig()).toBeNull();
  });

  it("gibt null wenn N8N_API_KEY fehlt", () => {
    process.env.N8N_WEBHOOK_URL = "http://localhost:5678";
    delete process.env.N8N_API_KEY;
    expect(buildN8nConfig()).toBeNull();
  });

  it("gibt Config wenn beide Env-Vars gesetzt", () => {
    process.env.N8N_WEBHOOK_URL = "http://localhost:5678";
    process.env.N8N_API_KEY = "test-key";
    const config = buildN8nConfig();
    expect(config).toEqual({
      webhookUrl: "http://localhost:5678",
      apiKey: "test-key",
    });
  });
});

describe("computeResumeUrl", () => {
  const config: N8nConfig = {
    webhookUrl: "http://localhost:5678",
    apiKey: "test-key",
  };

  it("berechnet Strategy Resume-URL korrekt", () => {
    const url = computeResumeUrl(config, "abc-123", "strategy");
    expect(url).toBe("http://localhost:5678/webhook-waiting/abc-123-strategy");
  });

  it("berechnet Concept Resume-URL korrekt", () => {
    const url = computeResumeUrl(config, "abc-123", "concept");
    expect(url).toBe("http://localhost:5678/webhook-waiting/abc-123-concept");
  });

  it("berechnet Translations Resume-URL korrekt", () => {
    const url = computeResumeUrl(config, "abc-123", "translations");
    expect(url).toBe("http://localhost:5678/webhook-waiting/abc-123-translations");
  });

  it("berechnet Assets Resume-URL korrekt", () => {
    const url = computeResumeUrl(config, "abc-123", "assets");
    expect(url).toBe("http://localhost:5678/webhook-waiting/abc-123-assets");
  });

  it("funktioniert mit UUID-Format", () => {
    const url = computeResumeUrl(config, "550e8400-e29b-41d4-a716-446655440000", "concept");
    expect(url).toBe("http://localhost:5678/webhook-waiting/550e8400-e29b-41d4-a716-446655440000-concept");
  });
});

describe("resumeN8nWait", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("gibt mock=true wenn n8n nicht konfiguriert", async () => {
    delete process.env.N8N_WEBHOOK_URL;
    delete process.env.N8N_API_KEY;

    const result = await resumeN8nWait("abc-123", "concept", { action: "approved" });
    expect(result.mock).toBe(true);
    expect(result.resumed).toBe(true);
  });

  it("versucht Resume wenn n8n konfiguriert", async () => {
    process.env.N8N_WEBHOOK_URL = "http://localhost:5678";
    process.env.N8N_API_KEY = "test-key";

    // Fetch mocken (wird fehlschlagen weil kein Server laeuft)
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const result = await resumeN8nWait("abc-123", "concept", { action: "approved" });
    expect(result.mock).toBe(false);
    expect(result.resumed).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:5678/webhook-waiting/abc-123-concept",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "approved" }),
      })
    );

    fetchSpy.mockRestore();
  });

  it("gibt resumed=true auch bei HTTP-Fehler (Resume ist best-effort)", async () => {
    process.env.N8N_WEBHOOK_URL = "http://localhost:5678";
    process.env.N8N_API_KEY = "test-key";

    // resumeWorkflow faengt Fehler intern ab (console.warn), gibt nicht weiter
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not Found", { status: 404 })
    );

    const result = await resumeN8nWait("abc-123", "concept");
    expect(result.mock).toBe(false);
    // resumed ist true weil resumeWorkflow keine Exceptions wirft
    expect(result.resumed).toBe(true);

    fetchSpy.mockRestore();
  });
});
