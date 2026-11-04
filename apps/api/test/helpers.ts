import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDatabase } from '../src/db/client.js';
import { emptyProviderRegistry, type ProviderRegistry } from '../src/providers/types.js';
import { LocalStorageDriver } from '../src/storage/local.js';
import { TEST_DATABASE_URL } from './global-setup.js';

export interface TestApp {
  app: FastifyInstance;
  storageDir: string;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

export async function createTestApp(
  options: { providers?: ProviderRegistry; maxUploadMb?: number } = {},
): Promise<TestApp> {
  const storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'namma-test-'));
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: TEST_DATABASE_URL,
    STORAGE_DIR: storageDir,
    MAX_UPLOAD_MB: String(options.maxUploadMb ?? 5),
  });
  const database = createDatabase(config.databaseUrl);
  const app = await buildApp({
    config,
    db: database.db,
    checkDatabase: async () => {
      await database.db.execute(sql`select 1`);
      return true;
    },
    storage: new LocalStorageDriver(storageDir),
    providers: options.providers ?? emptyProviderRegistry(),
  });
  await app.ready();

  return {
    app,
    storageDir,
    reset: async () => {
      await database.db.execute(sql`TRUNCATE projects CASCADE`);
    },
    close: async () => {
      await app.close();
      await database.close();
      await fs.rm(storageDir, { recursive: true, force: true });
    },
  };
}

export interface MultipartFile {
  field?: string;
  filename: string;
  contentType: string;
  data: Buffer;
}

/** Builds a multipart/form-data body for `app.inject`. */
export function multipart(files: MultipartFile[]): {
  payload: Buffer;
  headers: Record<string, string>;
} {
  const boundary = `----namma${Math.random().toString(16).slice(2)}`;
  const parts: Buffer[] = [];
  for (const f of files) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${f.field ?? 'files'}"; filename="${f.filename}"\r\nContent-Type: ${f.contentType}\r\n\r\n`,
      ),
      f.data,
      Buffer.from('\r\n'),
    );
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(parts),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

/** Minimal but structurally valid file headers for sniffing. */
export const fixtures = {
  jpeg: (size = 256) => {
    const b = Buffer.alloc(size, 0x11);
    b.set([0xff, 0xd8, 0xff, 0xe0], 0);
    return b;
  },
  png: () =>
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64),
    ]),
  mp4: () =>
    Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from('ftypisom'),
      Buffer.alloc(128, 0x01),
    ]),
};
