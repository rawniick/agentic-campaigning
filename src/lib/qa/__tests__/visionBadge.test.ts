import { describe, it, expect } from "vitest";
import { visionBadgeColor } from "../visionBadge";

describe("visionBadgeColor", () => {
  it("returns 'green' for scores at or above 0.8", () => {
    expect(visionBadgeColor(0.8)).toBe("green");
    expect(visionBadgeColor(0.95)).toBe("green");
    expect(visionBadgeColor(1)).toBe("green");
  });

  it("returns 'yellow' for scores in [0.5, 0.8)", () => {
    expect(visionBadgeColor(0.5)).toBe("yellow");
    expect(visionBadgeColor(0.65)).toBe("yellow");
    expect(visionBadgeColor(0.799999)).toBe("yellow");
  });

  it("returns 'red' for scores below 0.5", () => {
    expect(visionBadgeColor(0.49)).toBe("red");
    expect(visionBadgeColor(0)).toBe("red");
  });

  it("returns 'none' for null or undefined", () => {
    expect(visionBadgeColor(null)).toBe("none");
    expect(visionBadgeColor(undefined)).toBe("none");
  });
});
