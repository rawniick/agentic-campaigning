import { describe, it, expect } from "vitest";
import { dalleProvider } from "./dalle";

describe("dalleProvider", () => {
  it("hat korrekte ID und Capability", () => {
    expect(dalleProvider.id).toBe("dalle");
    expect(dalleProvider.capability).toBe("image");
    expect(dalleProvider.displayName).toBe("DALL-E 3");
  });

  it("ist nicht verfuegbar ohne OPENAI_API_KEY", () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(dalleProvider.isAvailable()).toBe(false);
    if (original) process.env.OPENAI_API_KEY = original;
  });

  it("liefert DALL-E spezifische Dimensionen", () => {
    const dims = dalleProvider.getSupportedDimensions();
    expect(dims).toHaveLength(3);
    expect(dims).toContainEqual({ width: 1024, height: 1024 });
    expect(dims).toContainEqual({ width: 1792, height: 1024 });
    expect(dims).toContainEqual({ width: 1024, height: 1792 });
  });
});
