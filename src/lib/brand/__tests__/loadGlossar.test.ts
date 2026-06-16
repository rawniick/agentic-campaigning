import { describe, it, expect } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import { loadGlossar } from "../loadGlossar";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_BASE_DIR = path.join(__dirname, "fixtures");

describe("loadGlossar", () => {
  it("loads passthrough_terms from the real wingo glossar (default baseDir)", () => {
    const g = loadGlossar("wingo");
    expect(g.passthrough_terms).toContain("Wingo Mobile Swiss");
    expect(g.passthrough_terms).toContain("5G im Swisscom Netz");
    expect(g.passthrough_terms.length).toBeGreaterThanOrEqual(9);
  });

  it("loads from a custom baseDir fixture", () => {
    const g = loadGlossar("wingo", { baseDir: FIXTURE_BASE_DIR });
    expect(g.passthrough_terms).toEqual([
      "Wingo",
      "Wingo Mobile Swiss",
      "Swisscom",
      "5G im Swisscom Netz",
    ]);
  });

  it("throws for a missing brand glossar", () => {
    expect(() => loadGlossar("does-not-exist")).toThrow();
  });
});
