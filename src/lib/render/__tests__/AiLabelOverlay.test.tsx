import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AiLabelOverlay } from "../AiLabelOverlay";

describe("AiLabelOverlay", () => {
  it("renders an img with the configured src and an alt attribute", () => {
    const html = renderToStaticMarkup(
      <AiLabelOverlay
        config={{
          src: "https://example.com/ai-label.svg",
          position: {
            anchor: "bottom-right",
            offset: { x: 8, y: 8 },
            size: { w: 40, h: 14 },
          },
        }}
      />
    );
    expect(html).toContain('src="https://example.com/ai-label.svg"');
    expect(html).toMatch(/alt="[^"]+"/);
    // KO: Pflicht-Brand-Asset darf nicht verzerrt werden.
    expect(html).toMatch(/object-fit:\s*contain/);
  });

  it.each([
    ["top-left",     { top: 7,    left: 5  }, ["right:",  "bottom:"]],
    ["top-right",    { top: 7,    right: 5 }, ["left:",   "bottom:"]],
    ["bottom-left",  { bottom: 7, left: 5  }, ["right:",  "top:"]],
    ["bottom-right", { bottom: 7, right: 5 }, ["left:",   "top:"]],
  ] as const)(
    "anchors to %s using offset and absolute positioning",
    (anchor, presentEdges, absentEdges) => {
      const html = renderToStaticMarkup(
        <AiLabelOverlay
          config={{
            src: "https://example.com/ai-label.svg",
            position: {
              anchor,
              offset: { x: 5, y: 7 },
              size: { w: 40, h: 14 },
            },
          }}
        />
      );
      expect(html).toMatch(/position:\s*['"]?absolute/);
      expect(html).toMatch(/width:\s*['"]?40/);
      expect(html).toMatch(/height:\s*['"]?14/);
      for (const [edge, value] of Object.entries(presentEdges)) {
        expect(html).toMatch(new RegExp(`${edge}:\\s*['"]?${value}`));
      }
      for (const edge of absentEdges) {
        expect(html).not.toContain(edge);
      }
    }
  );
});
