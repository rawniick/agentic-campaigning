import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DisclaimerForm } from "../DisclaimerForm";
import type { DisclaimerRow } from "@/lib/db/queries/disclaimers";

afterEach(cleanup);

const noop = () => {};

describe("DisclaimerForm", () => {
  it("renders the create-mode fields + submit button", () => {
    render(<DisclaimerForm action={noop} submitLabel="Anlegen" />);
    expect(screen.getByLabelText(/Slug/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Conditions/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Text DE/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Text EN/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anlegen" })).toBeInTheDocument();
  });

  it("pre-fills fields + adds hidden id in edit mode", () => {
    const row: DisclaimerRow = {
      id: "11111111-1111-4111-8111-111111111111",
      brand_id: "00000000-0000-0000-0000-000000000000",
      slug: "5g_netz",
      name: "5G",
      conditions_json: { network: "5g" },
      applies_to_categories: ["mobile"],
      text_de: "DE-Text",
      text_fr: "FR",
      text_it: "IT",
      text_en: "EN",
      is_required: true,
      is_active: false,
    };
    render(<DisclaimerForm action={noop} initial={row} submitLabel="Speichern" />);

    expect((screen.getByLabelText(/Slug/) as HTMLInputElement).value).toBe("5g_netz");
    expect((screen.getByLabelText(/Text DE/) as HTMLTextAreaElement).value).toBe(
      "DE-Text"
    );
    expect((screen.getByLabelText(/Conditions/) as HTMLTextAreaElement).value).toBe(
      '{"network":"5g"}'
    );
    const form = screen
      .getByRole("button", { name: "Speichern" })
      .closest("form")!;
    expect(form.querySelector('input[name="id"]')).toHaveValue(row.id);
  });
});
