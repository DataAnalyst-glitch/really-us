import type { BlobStoreLike } from "../src/blobs-storage.js";

// A fake Blobs store. A second adapter over the same fake store models a new serverless invocation.
export function fakeBlobStore(): BlobStoreLike {
  const data = new Map<string, string>();
  return {
    async get(key) {
      const v = data.get(key);
      return v === undefined ? null : JSON.parse(v);
    },
    async setJSON(key, value) {
      data.set(key, JSON.stringify(value));
    },
    async delete(key) {
      data.delete(key);
    },
    async list(options) {
      const prefix = options?.prefix ?? "";
      return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key })) };
    },
  };
}
