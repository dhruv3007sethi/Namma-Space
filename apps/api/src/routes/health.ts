import type { FastifyInstance } from 'fastify';
import type { Capabilities, Health } from '@namma/shared';
import { ACCEPTED_MEDIA_MIME_TYPES, API_PREFIX } from '@namma/shared';
import type { AppContext } from '../context.js';
import {
  KNOWN_RECONSTRUCTION_INTEGRATIONS,
  KNOWN_VISION_INTEGRATIONS,
} from '../providers/types.js';

export function registerHealthRoutes(app: FastifyInstance, ctx: AppContext): void {
  const startedAt = Date.now();

  app.get('/health', async (_req, reply) => {
    const [database, storage] = await Promise.all([
      ctx.checkDatabase().catch(() => false),
      ctx.storage.healthCheck().catch(() => false),
    ]);
    const body: Health = {
      status: database && storage ? 'ok' : 'degraded',
      version: ctx.config.version,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      checks: { database: database ? 'ok' : 'error', storage: storage ? 'ok' : 'error' },
    };
    return reply.code(body.status === 'ok' ? 200 : 503).send(body);
  });

  app.get(`${API_PREFIX}/capabilities`, async () => {
    const configuredRecon = new Map(ctx.providers.reconstruction.map((p) => [p.id, p.label]));
    const configuredVision = new Map(ctx.providers.vision.map((p) => [p.id, p.label]));

    const merge = (
      known: readonly { id: string; label: string }[],
      configured: Map<string, string>,
    ) => {
      const ids = new Set([...known.map((k) => k.id), ...configured.keys()]);
      return [...ids].map((id) => ({
        id,
        label: configured.get(id) ?? known.find((k) => k.id === id)?.label ?? id,
        configured: configured.has(id),
      }));
    };

    const body: Capabilities = {
      version: ctx.config.version,
      maxUploadBytes: ctx.config.maxUploadBytes,
      acceptedMimeTypes: [...ACCEPTED_MEDIA_MIME_TYPES],
      reconstructionProviders: merge(KNOWN_RECONSTRUCTION_INTEGRATIONS, configuredRecon),
      visionProviders: merge(KNOWN_VISION_INTEGRATIONS, configuredVision),
    };
    return { data: body };
  });
}
