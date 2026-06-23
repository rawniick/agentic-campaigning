// @vitest-environment node

import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { renderToPng } from "../renderToPng";

// Real-Boundary fuer das KO-Kriterium "Logo nie verzerren":
// logoConformity.test.ts prueft, dass jedes Template objectFit:contain SETZT —
// dieser Test beweist, dass die echte Render-Engine (Satori) das auch HONORIERT.
// Ein schmal-hohes Logo (24x96, 1:4) in einen breiten 80x24-Slot (10:3): bei
// contain skaliert es proportional auf die Slot-Hoehe -> duenner zentrierter
// Streifen (~6px) mit Letterbox daneben. Bei (faelschlichem) Stretch wuerde es
// den ganzen 80px-Slot blau fuellen. Der Scan unterscheidet beides eindeutig.
describe("renderToPng honoriert objectFit:contain", () => {
  it("letterboxt ein nicht-passendes Seitenverhaeltnis statt es zu strecken", async () => {
    const tallLogo = await sharp({
      create: { width: 24, height: 96, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .png()
      .toBuffer();

    const node = (
      <div
        style={{
          width: 300,
          height: 120,
          display: "flex",
          backgroundColor: "#EFEFEF",
        }}
      >
        <div style={{ display: "flex", padding: 16 }}>
          <img
            src={`data:image/png;base64,${tallLogo.toString("base64")}`}
            alt="Wingo"
            style={{ width: 80, height: 24, objectFit: "contain" }}
          />
        </div>
      </div>
    );

    const png = await renderToPng(node, { width: 300, height: 120 });
    const { data, info } = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => {
      const i = (y * info.width + x) * info.channels;
      return { r: data[i], g: data[i + 1], b: data[i + 2] };
    };

    // Logo-Slot: x in [16,96], y in [16,40]. Mittlere Zeile (y=28) scannen.
    let blue = 0;
    for (let x = 16; x < 96; x++) {
      const p = at(x, 28);
      if (p.b > 150 && p.r < 120 && p.g < 120) blue++;
    }

    expect(blue).toBeGreaterThan(0); // Logo wurde ueberhaupt gemalt
    expect(blue).toBeLessThan(20); // contain: schmaler Streifen, NICHT voller Slot (Stretch waere ~80)
  }, 30_000);
});
