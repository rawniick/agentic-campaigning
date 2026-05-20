// Pluggable Storage-Contract. Implementations:
//   - inMemoryStorage         (Tests)
//   - supabaseAssetStorage    (Production, Phase 1.E ff.)
// Halten alle den Asset-Lifecycle bewusst minimal: upload + read-back via URL.

export interface UploadResult {
  url: string;
}

export interface AssetStorage {
  upload(
    key: string,
    bytes: Buffer,
    contentType: string
  ): Promise<UploadResult>;
}
