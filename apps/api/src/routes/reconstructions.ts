import { and, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { API_PREFIX, createReconstructionSchema } from '@namma/shared';
import type { AppContext } from '../context.js';
import { mediaAssets, reconstructionJobs } from '../db/schema.js';
import { AppError, notFound, parseOrThrow } from '../lib/errors.js';
import { parseIdParam } from '../lib/params.js';
import { toReconstructionJob } from '../lib/serializers.js';
import { assertSpaceExists } from './spaces.js';

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled']);

export function registerReconstructionRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db, storage, providers } = ctx;

  app.get(`${API_PREFIX}/spaces/:id/reconstructions`, async (req) => {
    const spaceId = parseIdParam(req.params);
    await assertSpaceExists(ctx, spaceId);
    const rows = await db
      .select()
      .from(reconstructionJobs)
      .where(eq(reconstructionJobs.spaceId, spaceId))
      .orderBy(desc(reconstructionJobs.createdAt));
    return { data: rows.map(toReconstructionJob) };
  });

  /**
   * Requests a 3D reconstruction from a configured external provider. With no
   * provider configured this fails with PROVIDER_NOT_CONFIGURED; it never
   * produces a placeholder model.
   */
  app.post(`${API_PREFIX}/spaces/:id/reconstructions`, async (req, reply) => {
    const spaceId = parseIdParam(req.params);
    const input = parseOrThrow(createReconstructionSchema, req.body ?? {});
    await assertSpaceExists(ctx, spaceId);

    if (providers.reconstruction.length === 0) {
      throw new AppError(
        'PROVIDER_NOT_CONFIGURED',
        'No 3D reconstruction provider is configured. See docs/INTEGRATIONS.md.',
      );
    }
    const provider = input.provider
      ? providers.reconstruction.find((p) => p.id === input.provider)
      : providers.reconstruction[0];
    if (!provider) {
      throw new AppError(
        'PROVIDER_NOT_CONFIGURED',
        `Reconstruction provider "${input.provider}" is not configured`,
      );
    }

    const media = await db
      .select()
      .from(mediaAssets)
      .where(
        input.mediaAssetIds
          ? and(eq(mediaAssets.spaceId, spaceId), inArray(mediaAssets.id, input.mediaAssetIds))
          : eq(mediaAssets.spaceId, spaceId),
      );
    if (input.mediaAssetIds && media.length !== new Set(input.mediaAssetIds).size) {
      throw new AppError('VALIDATION_ERROR', 'Some media assets do not belong to this space');
    }
    if (media.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Upload photos or videos before reconstructing');
    }

    const [job] = await db
      .insert(reconstructionJobs)
      .values({ spaceId, provider: provider.id, inputMediaIds: media.map((m) => m.id) })
      .returning();

    try {
      const { externalJobId } = await provider.submit({
        jobId: job!.id,
        spaceId,
        media: media.map((m) => ({
          id: m.id,
          kind: m.kind,
          mimeType: m.mimeType,
          filename: m.originalFilename,
          open: () => storage.get(m.storageKey),
        })),
      });
      const [updated] = await db
        .update(reconstructionJobs)
        .set({ externalJobId, status: 'processing', updatedAt: new Date() })
        .where(eq(reconstructionJobs.id, job!.id))
        .returning();
      return reply.code(202).send({ data: toReconstructionJob(updated!) });
    } catch (err) {
      req.log.error({ err, jobId: job!.id }, 'reconstruction submission failed');
      const [failed] = await db
        .update(reconstructionJobs)
        .set({
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : 'Submission failed',
          updatedAt: new Date(),
        })
        .where(eq(reconstructionJobs.id, job!.id))
        .returning();
      return reply.code(202).send({ data: toReconstructionJob(failed!) });
    }
  });

  /** Returns a job, refreshing its status from the provider while it is in flight. */
  app.get(`${API_PREFIX}/reconstructions/:id`, async (req) => {
    const id = parseIdParam(req.params);
    const [job] = await db.select().from(reconstructionJobs).where(eq(reconstructionJobs.id, id));
    if (!job) throw notFound('Reconstruction job', id);

    const provider = providers.reconstruction.find((p) => p.id === job.provider);
    if (TERMINAL.has(job.status) || !provider || !job.externalJobId) {
      return { data: toReconstructionJob(job) };
    }
    const remote = await provider.getStatus(job.externalJobId);
    if (remote.status === job.status) return { data: toReconstructionJob(job) };
    const [updated] = await db
      .update(reconstructionJobs)
      .set({
        status: remote.status,
        errorMessage: remote.errorMessage ?? null,
        updatedAt: new Date(),
      })
      .where(eq(reconstructionJobs.id, id))
      .returning();
    return { data: toReconstructionJob(updated!) };
  });
}
