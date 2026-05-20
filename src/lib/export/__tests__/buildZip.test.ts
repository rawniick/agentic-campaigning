// @vitest-environment node

import { describe, it, expect } from "vitest";
import AdmZip from "adm-zip";
import { buildCampaignZipBuffer } from "../buildZip";

describe("buildCampaignZipBuffer", () => {
  it("returns a valid ZIP archive that contains every entry with its filename", async () => {
    const entries = [
      { filename: "a.png", bytes: Buffer.from([1, 2, 3, 4]) },
      { filename: "b.png", bytes: Buffer.from([5, 6, 7, 8, 9]) },
      { filename: "subfolder/c.png", bytes: Buffer.from([0xff, 0xff]) },
    ];

    const zip = await buildCampaignZipBuffer(entries);

    const archive = new AdmZip(zip);
    const names = archive.getEntries().map((e) => e.entryName);
    expect(names.sort()).toEqual(["a.png", "b.png", "subfolder/c.png"].sort());

    const aBytes = archive.getEntry("a.png")?.getData();
    expect(aBytes?.equals(Buffer.from([1, 2, 3, 4]))).toBe(true);
  });

  it("returns an empty but valid ZIP for an empty entry list", async () => {
    const zip = await buildCampaignZipBuffer([]);
    const archive = new AdmZip(zip);
    expect(archive.getEntries()).toHaveLength(0);
  });
});
