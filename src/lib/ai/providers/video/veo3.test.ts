import { describe, it, expect } from "vitest";
import { veo3Provider } from "./veo3";

describe("veo3Provider", () => {
  it("hat korrekte ID und Capability", () => {
    expect(veo3Provider.id).toBe("veo3");
    expect(veo3Provider.capability).toBe("video");
    expect(veo3Provider.displayName).toBe("Google Veo 3.1");
  });

  it("ist nicht verfuegbar ohne GOOGLE_GENAI_API_KEY", () => {
    const original = process.env.GOOGLE_GENAI_API_KEY;
    delete process.env.GOOGLE_GENAI_API_KEY;
    expect(veo3Provider.isAvailable()).toBe(false);
    if (original) process.env.GOOGLE_GENAI_API_KEY = original;
  });

  it("maximale Dauer ist 8 Sekunden", () => {
    expect(veo3Provider.getMaxDurationSeconds()).toBe(8);
  });

  it("unterstuetzt 16:9 und 9:16", () => {
    const ratios = veo3Provider.getSupportedAspectRatios();
    expect(ratios).toContain("16:9");
    expect(ratios).toContain("9:16");
  });
});
