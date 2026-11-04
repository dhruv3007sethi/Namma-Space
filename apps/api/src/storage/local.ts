import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { StorageDriver, StoredObject } from './storage.js';

const HEAD_BYTES = 64;

/** Stores objects on the local filesystem beneath `rootDir`. */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local';

  constructor(private readonly rootDir: string) {}

  private resolve(key: string): string {
    const full = path.resolve(this.rootDir, key);
    if (!full.startsWith(path.resolve(this.rootDir) + path.sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return full;
  }

  async put(key: string, body: Readable): Promise<StoredObject> {
    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = path.join(path.dirname(target), `.${randomUUID()}.part`);

    const hash = createHash('sha256');
    let size = 0;
    const headChunks: Buffer[] = [];
    let headLen = 0;

    const meter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        hash.update(chunk);
        size += chunk.length;
        if (headLen < HEAD_BYTES) {
          headChunks.push(chunk.subarray(0, HEAD_BYTES - headLen));
          headLen += Math.min(chunk.length, HEAD_BYTES - headLen);
        }
        cb(null, chunk);
      },
    });

    try {
      await pipeline(body, meter, createWriteStream(tmp));
      await fs.rename(tmp, target);
    } catch (err) {
      await fs.rm(tmp, { force: true });
      throw err;
    }

    return { key, sizeBytes: size, sha256: hash.digest('hex'), head: Buffer.concat(headChunks) };
  }

  async get(key: string, range?: { start: number; end: number }): Promise<Readable> {
    const full = this.resolve(key);
    await fs.access(full);
    return createReadStream(full, range);
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await fs.mkdir(this.rootDir, { recursive: true });
      await fs.access(this.rootDir, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }
}
