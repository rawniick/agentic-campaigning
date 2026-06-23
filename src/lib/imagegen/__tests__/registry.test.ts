import { describe, it, expect } from "vitest";
import {
  MODELS,
  listEnabledModels,
  findModel,
  defaultImageModel,
} from "../registry";

describe("imagegen registry", () => {
  it("listEnabledModels liefert nur aktivierte Modelle (Dropdown-Quelle)", () => {
    const en = listEnabledModels();
    expect(en.every((m) => m.enabled)).toBe(true);
    expect(en.some((m) => m.id === "nano-banana-2")).toBe(true);
    // Video (Seedance) ist Out-of-V1 -> disabled -> NICHT im Dropdown.
    expect(en.some((m) => m.id === "seedance-2-i2v")).toBe(false);
  });

  it("findModel findet per ID, undefined sonst", () => {
    expect(findModel("nano-banana-2")?.label).toBe("Nano Banana 2");
    expect(findModel("nope")).toBeUndefined();
  });

  it("defaultImageModel ist ein aktiviertes Bild-Modell", () => {
    const m = defaultImageModel();
    expect(m.enabled).toBe(true);
    expect(m.output).toBe("image");
  });

  it("jeder Eintrag hat eine gesetzte providerModelId (austauschbarer String)", () => {
    expect(MODELS.length).toBeGreaterThan(0);
    expect(MODELS.every((m) => m.providerModelId.length > 0)).toBe(true);
  });
});
