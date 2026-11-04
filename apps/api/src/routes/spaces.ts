import { desc, eq, getTableColumns, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { API_PREFIX, createSpaceSchema, updateSpaceSchema } from '@namma/shared';
import type { AppContext } from '../context.js';
import { mediaAssets, projects, spaces } from '../db/schema.js';
import { notFound, parseOrThrow } from '../lib/errors.js';
import { parseIdParam } from '../lib/params.js';
import { toSpace } from '../lib/serializers.js';

// Fully qualified on purpose: drizzle renders unqualified column names in single-table selects.
const mediaCount = sql<number>`(select count(*)::int from "media_assets" m where m."space_id" = "spaces"."id")`;

export async function assertSpaceExists(ctx: AppContext, id: string): Promise<void> {
  const [row] = await ctx.db.select({ id: spaces.id }).from(spaces).where(eq(spaces.id, id));
  if (!row) throw notFound('Space', id);
}

export function registerSpaceRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db } = ctx;

  const findSpace = async (id: string) => {
    const [row] = await db
      .select({ ...getTableColumns(spaces), mediaCount })
      .from(spaces)
      .where(eq(spaces.id, id));
    if (!row) throw notFound('Space', id);
    const { mediaCount: count, ...space } = row;
    return toSpace(space, count);
  };

  const touchProject = (projectId: string) =>
    db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));

  app.get(`${API_PREFIX}/projects/:id/spaces`, async (req) => {
    const projectId = parseIdParam(req.params);
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId));
    if (!project) throw notFound('Project', projectId);
    const rows = await db
      .select({ ...getTableColumns(spaces), mediaCount })
      .from(spaces)
      .where(eq(spaces.projectId, projectId))
      .orderBy(desc(spaces.createdAt));
    return { data: rows.map(({ mediaCount: count, ...s }) => toSpace(s, count)) };
  });

  app.post(`${API_PREFIX}/projects/:id/spaces`, async (req, reply) => {
    const projectId = parseIdParam(req.params);
    const input = parseOrThrow(createSpaceSchema, req.body);
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId));
    if (!project) throw notFound('Project', projectId);
    const [row] = await db
      .insert(spaces)
      .values({
        projectId,
        name: input.name,
        description: input.description || null,
        spaceType: input.spaceType,
        floorLevel: input.floorLevel ?? null,
      })
      .returning();
    await touchProject(projectId);
    return reply.code(201).send({ data: toSpace(row!, 0) });
  });

  app.get(`${API_PREFIX}/spaces/:id`, async (req) => ({
    data: await findSpace(parseIdParam(req.params)),
  }));

  app.patch(`${API_PREFIX}/spaces/:id`, async (req) => {
    const id = parseIdParam(req.params);
    const input = parseOrThrow(updateSpaceSchema, req.body);
    const updated = await db
      .update(spaces)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.spaceType !== undefined && { spaceType: input.spaceType }),
        ...(input.floorLevel !== undefined && { floorLevel: input.floorLevel }),
        updatedAt: new Date(),
      })
      .where(eq(spaces.id, id))
      .returning({ projectId: spaces.projectId });
    if (updated.length === 0) throw notFound('Space', id);
    await touchProject(updated[0]!.projectId);
    return { data: await findSpace(id) };
  });

  app.delete(`${API_PREFIX}/spaces/:id`, async (req, reply) => {
    const id = parseIdParam(req.params);
    const keys = await db
      .select({ key: mediaAssets.storageKey })
      .from(mediaAssets)
      .where(eq(mediaAssets.spaceId, id));
    const deleted = await db.delete(spaces).where(eq(spaces.id, id)).returning();
    if (deleted.length === 0) throw notFound('Space', id);
    await touchProject(deleted[0]!.projectId);
    await Promise.allSettled(keys.map(({ key }) => ctx.storage.delete(key)));
    return reply.code(204).send();
  });
}
