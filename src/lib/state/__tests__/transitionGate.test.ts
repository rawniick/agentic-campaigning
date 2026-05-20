import { describe, it, expect } from "vitest";
import { transitionGate } from "../transitionGate";

describe("transitionGate", () => {
  it("walks the full forward path from created to done", () => {
    expect(transitionGate("created", "COPY_GENERATED")).toBe("copy_pending");
    expect(transitionGate("copy_pending", "COPY_APPROVED")).toBe("hero_pending");
    expect(transitionGate("hero_pending", "HERO_SELECTED")).toBe("layout_pending");
    expect(transitionGate("layout_pending", "LAYOUT_APPROVED")).toBe("final_pending");
    expect(transitionGate("final_pending", "FINAL_APPROVED")).toBe("rendering");
    expect(transitionGate("rendering", "RENDER_COMPLETE")).toBe("done");
  });

  it("rejects events that are not valid for the current state", () => {
    expect(() => transitionGate("created", "COPY_APPROVED")).toThrow(/Invalid transition/);
    expect(() => transitionGate("copy_pending", "FINAL_APPROVED")).toThrow();
    expect(() => transitionGate("done", "COPY_APPROVED")).toThrow();
  });

  it("supports re-opening to any earlier gate from done", () => {
    expect(transitionGate("done", "REOPEN_TO_COPY")).toBe("copy_pending");
    expect(transitionGate("done", "REOPEN_TO_HERO")).toBe("hero_pending");
    expect(transitionGate("done", "REOPEN_TO_LAYOUT")).toBe("layout_pending");
    expect(transitionGate("done", "REOPEN_TO_FINAL")).toBe("final_pending");
  });

  it("supports re-opening from any gate to any earlier gate", () => {
    // Mid-flow: User ist in Gate 3, will zurueck zu Gate 1
    expect(transitionGate("layout_pending", "REOPEN_TO_COPY")).toBe("copy_pending");
    expect(transitionGate("final_pending", "REOPEN_TO_HERO")).toBe("hero_pending");
  });

  it("forbids re-opening forward (REOPEN_TO_FINAL from copy_pending)", () => {
    expect(() => transitionGate("copy_pending", "REOPEN_TO_FINAL")).toThrow();
    expect(() => transitionGate("copy_pending", "REOPEN_TO_HERO")).toThrow();
  });
});
