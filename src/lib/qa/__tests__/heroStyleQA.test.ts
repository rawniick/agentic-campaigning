import { describe, it, expect, vi } from "vitest";
import { scoreHeroStyle } from "../heroStyleQA";
import type { VisionLLMFn } from "../claudeVisionClient";

const IMAGE_URL = "memory://hero/candidate-0.png";
const STYLE_NOTES = "Wingo-Rot #FF5759, klare Flaechen, freundlich-direkter Look";

describe("scoreHeroStyle", () => {
  it("parses score and issues from the vision response", async () => {
    const fakeVision: VisionLLMFn = async () =>
      JSON.stringify({ score: 0.84, issues: ["Hintergrund leicht zu dunkel"] });

    const res = await scoreHeroStyle({
      imageUrl: IMAGE_URL,
      brandStyleNotes: STYLE_NOTES,
      vision: fakeVision,
    });

    expect(res.score).toBe(0.84);
    expect(res.issues).toEqual(["Hintergrund leicht zu dunkel"]);
  });

  it("passes when score is at or above the default threshold (0.7)", async () => {
    const fakeVision: VisionLLMFn = async () =>
      JSON.stringify({ score: 0.7, issues: [] });

    const res = await scoreHeroStyle({
      imageUrl: IMAGE_URL,
      brandStyleNotes: STYLE_NOTES,
      vision: fakeVision,
    });

    expect(res.pass).toBe(true);
  });

  it("fails when score is below the default threshold (0.7)", async () => {
    const fakeVision: VisionLLMFn = async () =>
      JSON.stringify({ score: 0.69, issues: [] });

    const res = await scoreHeroStyle({
      imageUrl: IMAGE_URL,
      brandStyleNotes: STYLE_NOTES,
      vision: fakeVision,
    });

    expect(res.pass).toBe(false);
  });

  it("honours a custom threshold", async () => {
    const fakeVision: VisionLLMFn = async () =>
      JSON.stringify({ score: 0.84, issues: [] });

    const res = await scoreHeroStyle({
      imageUrl: IMAGE_URL,
      brandStyleNotes: STYLE_NOTES,
      vision: fakeVision,
      threshold: 0.9,
    });

    expect(res.pass).toBe(false);
  });

  it("defaults issues to an empty array when the model omits them", async () => {
    const fakeVision: VisionLLMFn = async () =>
      JSON.stringify({ score: 0.95 });

    const res = await scoreHeroStyle({
      imageUrl: IMAGE_URL,
      brandStyleNotes: STYLE_NOTES,
      vision: fakeVision,
    });

    expect(res.issues).toEqual([]);
  });

  it("throws when the score is out of the 0..1 range", async () => {
    const fakeVision: VisionLLMFn = async () =>
      JSON.stringify({ score: 1.5, issues: [] });

    await expect(
      scoreHeroStyle({
        imageUrl: IMAGE_URL,
        brandStyleNotes: STYLE_NOTES,
        vision: fakeVision,
      })
    ).rejects.toThrow();
  });

  it("throws when the vision output is not valid JSON", async () => {
    const fakeVision: VisionLLMFn = async () => "kein JSON, nur Prosa";

    await expect(
      scoreHeroStyle({
        imageUrl: IMAGE_URL,
        brandStyleNotes: STYLE_NOTES,
        vision: fakeVision,
      })
    ).rejects.toThrow();
  });

  it("passes the imageUrl and brandStyleNotes into the vision fn", async () => {
    const fakeVision = vi.fn<VisionLLMFn>(async () =>
      JSON.stringify({ score: 0.8, issues: [] })
    );

    await scoreHeroStyle({
      imageUrl: IMAGE_URL,
      brandStyleNotes: STYLE_NOTES,
      vision: fakeVision,
    });

    expect(fakeVision).toHaveBeenCalledTimes(1);
    const req = fakeVision.mock.calls[0][0];
    expect(req.imageBase64).toBe(IMAGE_URL);
    expect(req.userText).toContain(STYLE_NOTES);
  });
});
