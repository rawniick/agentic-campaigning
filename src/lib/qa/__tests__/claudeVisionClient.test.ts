import { describe, it, expect } from "vitest";
import {
  createClaudeVisionClient,
  type VisionLLMFn,
} from "../claudeVisionClient";

const INPUT = {
  imageBytes: Buffer.from("PNGDATA"),
  imageMimeType: "image/png",
  brandPrimaryHex: "#E61E2A",
  formatCode: "dv360_halfpage",
};

describe("createClaudeVisionClient", () => {
  it("computes the score as the mean of the four checks and parses notes", async () => {
    const fakeLLM: VisionLLMFn = async () =>
      JSON.stringify({
        checks: {
          logo_bounds: 0.9,
          color_match: 0.8,
          safezone: 1.0,
          style_consistency: 0.7,
        },
        notes: "leicht zu nah am Rand",
      });

    const client = createClaudeVisionClient(fakeLLM);
    const res = await client.analyze(INPUT);

    // (0.9 + 0.8 + 1.0 + 0.7) / 4 = 0.85
    expect(res.score).toBeCloseTo(0.85, 3);
    expect(res.checks.safezone).toBe(1.0);
    expect(res.notes).toBe("leicht zu nah am Rand");
  });

  it("passes the base64 image, brand color and format code into the request", async () => {
    const seen: Record<string, string> = {};
    const fakeLLM: VisionLLMFn = async (req) => {
      seen.imageBase64 = req.imageBase64;
      seen.userText = req.userText;
      seen.imageMediaType = req.imageMediaType;
      return JSON.stringify({
        checks: {
          logo_bounds: 1,
          color_match: 1,
          safezone: 1,
          style_consistency: 1,
        },
      });
    };

    const client = createClaudeVisionClient(fakeLLM);
    await client.analyze(INPUT);

    expect(seen.imageBase64).toBe(Buffer.from("PNGDATA").toString("base64"));
    expect(seen.imageMediaType).toBe("image/png");
    expect(seen.userText).toContain("#E61E2A");
    expect(seen.userText).toContain("dv360_halfpage");
  });

  it("throws on invalid LLM output (score out of range)", async () => {
    const fakeLLM: VisionLLMFn = async () =>
      JSON.stringify({
        checks: {
          logo_bounds: 2,
          color_match: 1,
          safezone: 1,
          style_consistency: 1,
        },
      });

    const client = createClaudeVisionClient(fakeLLM);
    await expect(client.analyze(INPUT)).rejects.toThrow();
  });
});
