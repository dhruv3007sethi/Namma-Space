import { desc, eq, getTableColumns, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { API_PREFIX, createProjectSchema, updateProjectSchema } from '@namma/shared';
import type { AppContext } from '../context.js';
import { mediaAssets, projects, spaces } from '../db/schema.js';
import { notFound, parseOrThrow } from '../lib/errors.js';
import { parseIdParam } from '../lib/params.js';
import { toProject } from '../lib/serializers.js';

// Fully qualified on purpose: drizzle renders unqualified column names in single-table selects.
const spaceCount = sql<number>`(select count(*)::int from "spaces" s where s."project_id" = "projects"."id")`;

export function registerProjectRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db } = ctx;
  const base = `${API_PREFIX}/projects`;

  const findProject = async (id: string) => {
    const [row] = await db
      .select({ ...getTableColumns(projects), spaceCount })
      .from(projects)
      .where(eq(projects.id, id));
    if (!row) throw notFound('Project', id);
    const { spaceCount: count, ...project } = row;
    return toProject(project, count);
  };

  app.get(base, async () => {
    const rows = await db
      .select({ ...getTableColumns(projects), spaceCount })
      .from(projects)
      .orderBy(desc(projects.updatedAt));
    return { data: rows.map(({ spaceCount: count, ...p }) => toProject(p, count)) };
  });

  app.post(base, async (req, reply) => {
    const input = parseOrThrow(createProjectSchema, req.body);
    const [row] = await db
      .insert(projects)
      .values({ name: input.name, description: input.description || null })
      .returning();
    return reply.code(201).send({ data: toProject(row!, 0) });
  });

  app.get(`${base}/:id`, async (req) => ({ data: await findProject(parseIdParam(req.params)) }));

  app.patch(`${base}/:id`, async (req) => {
    const id = parseIdParam(req.params);
    const input = parseOrThrow(updateProjectSchema, req.body);
    const updated = await db
      .update(projects)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description || null }),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning({ id: projects.id });
    if (updated.length === 0) throw notFound('Project', id);
    return { data: await findProject(id) };
  });

  app.delete(`${base}/:id`, async (req, reply) => {
    const id = parseIdParam(req.params);
    // Collect blob keys first: rows cascade-delete, files must be removed explicitly.
    const keys = await db
      .select({ key: mediaAssets.storageKey })
      .from(mediaAssets)
      .innerJoin(spaces, eq(spaces.id, mediaAssets.spaceId))
      .where(eq(spaces.projectId, id));
    const deleted = await db.delete(projects).where(eq(projects.id, id)).returning();
    if (deleted.length === 0) throw notFound('Project', id);
    await Promise.allSettled(keys.map(({ key }) => ctx.storage.delete(key)));
    return reply.code(204).send();
  });
}
