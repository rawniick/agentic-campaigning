import { describe, it, expect } from "vitest";
import { parseDisclaimerForm } from "../disclaimerForm";

const full = {
  slug: "5g_netz",
  name: "5G im Swisscom Netz",
  conditions_json: '{"network":"5g"}',
  applies_to_categories: "mobile, TV",
  text_de: "5G im Swisscom Netz",
  text_fr: "5G FR",
  text_it: "5G IT",
  text_en: "5G EN",
  is_required: "on",
  is_active: "on",
};

describe("parseDisclaimerForm", () => {
  it("parses a full valid form", () => {
    const v = parseDisclaimerForm(full);
    expect(v.slug).toBe("5g_netz");
    expect(v.conditions_json).toEqual({ network: "5g" });
    expect(v.applies_to_categories).toEqual(["mobile", "tv"]); // getrimmt + lowercased
    expect(v.is_required).toBe(true);
    expect(v.is_active).toBe(true);
  });

  it("treats empty conditions as {}", () => {
    expect(parseDisclaimerForm({ ...full, conditions_json: "" }).conditions_json).toEqual({});
  });

  it("rejects invalid JSON conditions", () => {
    expect(() => parseDisclaimerForm({ ...full, conditions_json: "{network:5g}" })).toThrow();
  });

  it("rejects non-object (array) conditions", () => {
    expect(() => parseDisclaimerForm({ ...full, conditions_json: "[1,2]" })).toThrow();
  });

  it("treats absent checkboxes as false", () => {
    const { is_required, ...noReq } = full;
    const v = parseDisclaimerForm({ ...noReq, is_active: "on" });
    void is_required;
    expect(v.is_required).toBe(false);
    expect(v.is_active).toBe(true);
  });

  it("requires slug, name and all four language texts", () => {
    expect(() => parseDisclaimerForm({ ...full, slug: "" })).toThrow();
    expect(() => parseDisclaimerForm({ ...full, text_fr: "  " })).toThrow();
  });

  it("empty categories -> []", () => {
    expect(parseDisclaimerForm({ ...full, applies_to_categories: "" }).applies_to_categories).toEqual([]);
  });

  it("rejects an unknown category (typo) instead of silently storing it", () => {
    expect(() =>
      parseDisclaimerForm({ ...full, applies_to_categories: "mobile, tvv" })
    ).toThrow(/tvv/i);
  });
});
