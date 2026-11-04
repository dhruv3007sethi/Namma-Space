import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { API_PREFIX, mediaKindForMimeType, type MediaKind } from '@namma/shared';
import type { AppContext } from '../context.js';
import { mediaAssets } from '../db/schema.js';
import { AppError, notFound } from '../lib/errors.js';
import { parseIdParam } from '../lib/params.js';
import { toMediaAsset } from '../lib/serializers.js';
import { mimeTypesCompatible, sniffMediaType } from '../lib/sniff.js';
import { assertSpaceExists } from './spaces.js';

const SAFE_EXT = /^\.[a-z0-9]{1,8}$/;
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(CONTROL_CHARS, '').trim();
  return (base || 'upload').slice(0, 255);
}

function parseRange(header: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, s, e] = match;
  let start: number;
  let end: number;
  if (s === '' && e === '') return null;
  if (s === '') {
    // Suffix range: last N bytes.
    start = Math.max(size - Number(e), 0);
    end = size - 1;
  } else {
    start = Number(s);
    end = e === '' ? size - 1 : Math.min(Number(e), size - 1);
  }
  if (start > end || start >= size) return null;
  return { start, end };
}

interface PendingUpload {
  id: string;
  key: string;
  kind: MediaKind;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

export function registerMediaRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db, storage } = ctx;

  const findMedia = async (id: string) => {
    const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id));
    if (!row) throw notFound('Media asset', id);
    return row;
  };

  app.get(`${API_PREFIX}/spaces/:id/media`, async (req) => {
    const spaceId = parseIdParam(req.params);
    await assertSpaceExists(ctx, spaceId);
    const rows = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.spaceId, spaceId))
      .orderBy(desc(mediaAssets.createdAt));
    return { data: rows.map(toMediaAsset) };
  });

  /** Multipart upload of one or more photos/videos (field name is not significant). */
  app.post(`${API_PREFIX}/spaces/:id/media`, async (req, reply) => {
    const spaceId = parseIdParam(req.params);
    await assertSpaceExists(ctx, spaceId);
    if (!req.isMultipart()) {
      throw new AppError('VALIDATION_ERROR', 'Expected a multipart/form-data request');
    }

    const pending: PendingUpload[] = [];
    const cleanup = () => Promise.allSettled(pending.map((p) => storage.delete(p.key)));

    try {
      for await (const part of req.files()) {
        const declared = part.mimetype.toLowerCase();
        const kind = mediaKindForMimeType(declared);
        const originalFilename = sanitizeFilename(part.filename);
        if (!kind) {
          part.file.resume();
          throw new AppError(
            'UNSUPPORTED_MEDIA_TYPE',
            `${originalFilename}: ${declared} is not a supported photo or video type`,
          );
        }

        const id = randomUUID();
        const ext = path.extname(originalFilename).toLowerCase();
        const key = `spaces/${spaceId}/${id}${SAFE_EXT.test(ext) ? ext : ''}`;
        const stored = await storage.put(key, part.file);
        const entry: PendingUpload = {
          id,
          key,
          kind,
          originalFilename,
          mimeType: declared,
          sizeBytes: stored.sizeBytes,
          sha256: stored.sha256,
        };
        pending.push(entry);

        if (part.file.truncated) {
          throw new AppError(
            'PAYLOAD_TOO_LARGE',
            `${originalFilename} exceeds the ${Math.round(ctx.config.maxUploadBytes / 1024 / 1024)} MB upload limit`,
          );
        }
        if (stored.sizeBytes === 0) {
          throw new AppError('VALIDATION_ERROR', `${originalFilename} is empty`);
        }
        const sniffed = sniffMediaType(stored.head);
        if (!sniffed || !mimeTypesCompatible(declared, sniffed)) {
          throw new AppError(
            'UNSUPPORTED_MEDIA_TYPE',
            `${originalFilename}: file contents do not match declared type ${declared}`,
          );
        }
      }

      if (pending.length === 0) {
        throw new AppError('VALIDATION_ERROR', 'No files were included in the upload');
      }

      const rows = await db
        .insert(mediaAssets)
        .values(
          pending.map((p) => ({
            id: p.id,
            spaceId,
            kind: p.kind,
            originalFilename: p.originalFilename,
            mimeType: p.mimeType,
            sizeBytes: p.sizeBytes,
            sha256: p.sha256,
            storageKey: p.key,
          })),
        )
        .returning();
      return reply.code(201).send({ data: rows.map(toMediaAsset) });
    } catch (err) {
      await cleanup();
      throw err;
    }
  });

  app.get(`${API_PREFIX}/media/:id`, async (req) => ({
    data: toMediaAsset(await findMedia(parseIdParam(req.params))),
  }));

  app.get(`${API_PREFIX}/media/:id/content`, async (req, reply) => {
    const row = await findMedia(parseIdParam(req.params));
    const etag = `"${row.sha256}"`;
    reply
      .header('content-type', row.mimeType)
      .header('accept-ranges', 'bytes')
      .header('etag', etag)
      .header('cache-control', 'private, max-age=31536000, immutable')
      .header(
        'content-disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(row.originalFilename)}`,
      );

    if (req.headers['if-none-match'] === etag) return reply.code(304).send();

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const range = parseRange(rangeHeader, row.sizeBytes);
      if (!range) {
        return reply.code(416).header('content-range', `bytes */${row.sizeBytes}`).send();
      }
      const stream = await storage.get(row.storageKey, range);
      return reply
        .code(206)
        .header('content-range', `bytes ${range.start}-${range.end}/${row.sizeBytes}`)
        .header('content-length', range.end - range.start + 1)
        .send(stream);
    }

    const stream = await storage.get(row.storageKey);
    return reply.header('content-length', row.sizeBytes).send(stream);
  });

  app.delete(`${API_PREFIX}/media/:id`, async (req, reply) => {
    const id = parseIdParam(req.params);
    const [row] = await db.delete(mediaAssets).where(eq(mediaAssets.id, id)).returning();
    if (!row) throw notFound('Media asset', id);
    await storage.delete(row.storageKey);
    return reply.code(204).send();
  });
}
