import type { AssetStorage, UploadResult } from "./types";

export interface InMemoryAssetStorage extends AssetStorage {
  read(key: string): Buffer | undefined;
  has(key: string): boolean;
  clear(): void;
}

// Test-only: haelt Bytes im RAM und liefert eine deterministische "memory://"-URL.
// Hinweis: nicht thread-safe, nicht persistent — bewusst.
export function createInMemoryStorage(): InMemoryAssetStorage {
  const store = new Map<string, Buffer>();

  return {
    async upload(key, bytes): Promise<UploadResult> {
      store.set(key, bytes);
      return { url: `memory://${key}` };
    },
    read(key) {
      return store.get(key);
    },
    has(key) {
      return store.has(key);
    },
    clear() {
      store.clear();
    },
  };
}
