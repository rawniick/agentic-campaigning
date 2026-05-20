import archiver from "archiver";

export interface CampaignZipEntry {
  filename: string;
  bytes: Buffer;
}

// In-memory ZIP-Builder fuer Asset-Bundles. Pure: keine DB, kein Storage.
// Streams werden in einen Buffer akkumuliert — V1-Asset-Volumen ist klein
// genug (44 PNGs * <500KB), kein File-Streaming noetig.
export async function buildCampaignZipBuffer(
  entries: CampaignZipEntry[]
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("warning", (err) => {
      if ((err as { code?: string }).code !== "ENOENT") reject(err);
    });
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    for (const entry of entries) {
      archive.append(entry.bytes, { name: entry.filename });
    }

    archive.finalize();
  });
}
