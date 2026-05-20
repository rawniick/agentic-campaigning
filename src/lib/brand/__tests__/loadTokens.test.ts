import { describe, it, expect } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import { loadBrandTokens } from "../loadTokens";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_DIR = path.join(__dirname, "fixtures");

describe("loadBrandTokens", () => {
  it("parses a valid Wingo tokens.json and exposes the core brand identity", () => {
    const tokens = loadBrandTokens("wingo-valid", { baseDir: FIXTURE_DIR });

    expect(tokens.colors.primary.hex).toBe("#E61E2A");
    expect(tokens.typography.fonts.headline.family).toBe("WingoSans-Bold");
    expect(tokens.logo.default_variant).toBe("kombi");
  });

  it("refuses to load tokens with an empty required color hex", () => {
    expect(() =>
      loadBrandTokens("wingo-empty-hex", { baseDir: FIXTURE_DIR })
    ).toThrow();
  });
});
