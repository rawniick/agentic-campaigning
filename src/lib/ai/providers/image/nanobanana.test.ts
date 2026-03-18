import { describe, it, expect } from "vitest";
import { nanobananaProvider } from "./nanobanana";

describe("nanobananaProvider", () => {
  it("hat korrekte ID und Capability", () => {
    expect(nanobananaProvider.id).toBe("nanobanana");
    expect(nanobananaProvider.capability).toBe("image");
    expect(nanobananaProvider.displayName).toBe("Google Nano Banana 2");
  });

  it("ist nicht verfuegbar ohne GOOGLE_GENAI_API_KEY", () => {
    const original = process.env.GOOGLE_GENAI_API_KEY;
    delete process.env.GOOGLE_GENAI_API_KEY;
    expect(nanobananaProvider.isAvailable()).toBe(false);
    if (original) process.env.GOOGLE_GENAI_API_KEY = original;
  });

  it("liefert unterstuetzte Dimensionen", () => {
    const dims = nanobananaProvider.getSupportedDimensions();
    expect(dims.length).toBeGreaterThan(0);
    expect(dims).toContainEqual({ width: 1024, height: 1024 });
    expect(dims).toContainEqual({ width: 1920, height: 1080 });
  });
});
