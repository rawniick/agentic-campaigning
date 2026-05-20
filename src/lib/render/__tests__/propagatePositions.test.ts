import { describe, it, expect } from "vitest";
import { propagatePositions } from "../propagatePositions";

describe("propagatePositions", () => {
  it("converts relative coordinates to absolute pixels for a given format", () => {
    const result = propagatePositions(
      { x: 0.5, y: 0.5, w: 0.4, h: 0.2 },
      { width: 1000, height: 500 }
    );
    expect(result).toEqual({ x: 500, y: 250, w: 400, h: 100 });
  });

  it("clamps x and y to the safezone top-left when relative position falls outside", () => {
    const result = propagatePositions(
      { x: 0.0, y: 0.0, w: 0.2, h: 0.2 },
      {
        width: 1000,
        height: 500,
        safezone: { top: 20, right: 20, bottom: 20, left: 20 },
      }
    );
    expect(result.x).toBe(20);
    expect(result.y).toBe(20);
  });

  it("shrinks width/height when element would overflow the safezone right/bottom edge", () => {
    const result = propagatePositions(
      { x: 0.9, y: 0.9, w: 0.2, h: 0.2 },
      {
        width: 1000,
        height: 500,
        safezone: { top: 0, right: 50, bottom: 0, left: 0 },
      }
    );
    // x=900, w=200 -> would reach 1100; safezone-right is at 950 -> w shrinks to 50
    expect(result.x).toBe(900);
    expect(result.w).toBe(50);
  });

  it("leaves coordinates unchanged when no safezone is provided", () => {
    const result = propagatePositions(
      { x: 0.0, y: 0.0, w: 0.1, h: 0.1 },
      { width: 1000, height: 500 }
    );
    expect(result).toEqual({ x: 0, y: 0, w: 100, h: 50 });
  });

  it("shrinks height when element would overflow the safezone bottom edge", () => {
    const result = propagatePositions(
      { x: 0.0, y: 0.9, w: 0.1, h: 0.2 },
      {
        width: 1000,
        height: 500,
        safezone: { top: 0, right: 0, bottom: 50, left: 0 },
      }
    );
    // y=450, h=100 -> would reach 550; bottom-safezone-edge=450 -> h shrinks to 0
    expect(result.y).toBe(450);
    expect(result.h).toBe(0);
  });

  it("preserves x and y inside the safezone region (no false-positive clamping)", () => {
    const result = propagatePositions(
      { x: 0.5, y: 0.5, w: 0.1, h: 0.1 },
      {
        width: 1000,
        height: 500,
        safezone: { top: 10, right: 10, bottom: 10, left: 10 },
      }
    );
    expect(result.x).toBe(500);
    expect(result.y).toBe(250);
    expect(result.w).toBe(100);
    expect(result.h).toBe(50);
  });
});
