import type { Readable } from 'node:stream';

export interface StoredObject {
  key: string;
  sizeBytes: number;
  sha256: string;
  /** First bytes of the object, for content sniffing. */
  head: Uint8Array;
}

/**
 * Binary object storage abstraction. Phase 1 ships a local-disk driver; an
 * S3-compatible driver can implement the same contract later.
 */
export interface StorageDriver {
  readonly name: string;
  put(key: string, body: Readable): Promise<StoredObject>;
  /** Opens an object for reading; `range` is inclusive, as in HTTP Range. */
  get(key: string, range?: { start: number; end: number }): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  healthCheck(): Promise<boolean>;
}
