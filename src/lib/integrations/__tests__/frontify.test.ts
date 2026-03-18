import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildFrontifyConfig, FrontifyError } from "../frontify";

describe("buildFrontifyConfig", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("gibt null zurueck wenn FRONTIFY_DOMAIN fehlt", () => {
    vi.stubEnv("FRONTIFY_DOMAIN", "");
    vi.stubEnv("FRONTIFY_TOKEN", "test-token");
    expect(buildFrontifyConfig()).toBeNull();
  });

  it("gibt null zurueck wenn FRONTIFY_TOKEN fehlt", () => {
    vi.stubEnv("FRONTIFY_DOMAIN", "acme.frontify.com");
    vi.stubEnv("FRONTIFY_TOKEN", "");
    expect(buildFrontifyConfig()).toBeNull();
  });

  it("erstellt Config mit allen Env-Vars", () => {
    vi.stubEnv("FRONTIFY_DOMAIN", "acme.frontify.com");
    vi.stubEnv("FRONTIFY_TOKEN", "my-token");
    vi.stubEnv("FRONTIFY_BRAND_ID", "brand-123");

    const config = buildFrontifyConfig();
    expect(config).not.toBeNull();
    expect(config!.domain).toBe("acme.frontify.com");
    expect(config!.token).toBe("my-token");
    expect(config!.brandId).toBe("brand-123");
  });

  it("brandId ist optional", () => {
    vi.stubEnv("FRONTIFY_DOMAIN", "acme.frontify.com");
    vi.stubEnv("FRONTIFY_TOKEN", "my-token");
    vi.stubEnv("FRONTIFY_BRAND_ID", "");

    const config = buildFrontifyConfig();
    expect(config).not.toBeNull();
    expect(config!.brandId).toBeUndefined();
  });
});

describe("FrontifyError", () => {
  it("hat korrekten name und code", () => {
    const err = new FrontifyError("UNAUTHENTICATED", "Token abgelaufen");
    expect(err.name).toBe("FrontifyError");
    expect(err.code).toBe("UNAUTHENTICATED");
    expect(err.message).toBe("Token abgelaufen");
  });

  it("speichert cause", () => {
    const cause = new Error("network");
    const err = new FrontifyError("UNKNOWN", "Fehler", cause);
    expect(err.cause).toBe(cause);
  });

  it("unterstuetzt alle Error-Codes", () => {
    const codes = ["UNAUTHENTICATED", "NOT_FOUND", "RATE_LIMITED", "QUERY_ERROR", "UNKNOWN"] as const;
    for (const code of codes) {
      const err = new FrontifyError(code, `Test ${code}`);
      expect(err.code).toBe(code);
    }
  });
});
