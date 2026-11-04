import { and, asc, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { API_PREFIX, createPoiSchema, poiSearchQuerySchema, updatePoiSchema } from '@namma/shared';
import type { AppContext } from '../context.js';
import { pointsOfInterest, spaces } from '../db/schema.js';
import { notFound, parseOrThrow } from '../lib/errors.js';
import { parseIdParam } from '../lib/params.js';
import { toPoi } from '../lib/serializers.js';
import { assertSpaceExists } from './spaces.js';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function registerPoiRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db } = ctx;

  app.get(`${API_PREFIX}/spaces/:id/pois`, async (req) => {
    const spaceId = parseIdParam(req.params);
    await assertSpaceExists(ctx, spaceId);
    const rows = await db
      .select()
      .from(pointsOfInterest)
      .where(eq(pointsOfInterest.spaceId, spaceId))
      .orderBy(asc(pointsOfInterest.name));
    return { data: rows.map(toPoi) };
  });

  app.post(`${API_PREFIX}/spaces/:id/pois`, async (req, reply) => {
    const spaceId = parseIdParam(req.params);
    const input = parseOrThrow(createPoiSchema, req.body);
    await assertSpaceExists(ctx, spaceId);
    const [row] = await db
      .insert(pointsOfInterest)
      .values({
        spaceId,
        name: input.name,
        description: input.description || null,
        category: input.category,
        source: 'manual',
        positionX: input.position.x,
        positionY: input.position.y,
        positionZ: input.position.z,
      })
      .returning();
    return reply.code(201).send({ data: toPoi(row!) });
  });

  /** Text + facet search across POIs, optionally scoped to a project or space. */
  app.get(`${API_PREFIX}/pois/search`, async (req) => {
    const query = parseOrThrow(poiSearchQuerySchema, req.query);
    const conditions: SQL[] = [];
    if (query.q) {
      const pattern = `%${escapeLike(query.q)}%`;
      conditions.push(
        or(ilike(pointsOfInterest.name, pattern), ilike(pointsOfInterest.description, pattern))!,
      );
    }
    if (query.category) conditions.push(eq(pointsOfInterest.category, query.category));
    if (query.spaceId) conditions.push(eq(pointsOfInterest.spaceId, query.spaceId));
    if (query.projectId) conditions.push(eq(spaces.projectId, query.projectId));

    const rows = await db
      .select({ poi: pointsOfInterest })
      .from(pointsOfInterest)
      .innerJoin(spaces, eq(spaces.id, pointsOfInterest.spaceId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(pointsOfInterest.name))
      .limit(query.limit);
    return { data: rows.map((r) => toPoi(r.poi)) };
  });

  app.patch(`${API_PREFIX}/pois/:id`, async (req) => {
    const id = parseIdParam(req.params);
    const input = parseOrThrow(updatePoiSchema, req.body);
    const [row] = await db
      .update(pointsOfInterest)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.position && {
          positionX: input.position.x,
          positionY: input.position.y,
          positionZ: input.position.z,
        }),
        updatedAt: new Date(),
      })
      .where(eq(pointsOfInterest.id, id))
      .returning();
    if (!row) throw notFound('Point of interest', id);
    return { data: toPoi(row) };
  });

  app.delete(`${API_PREFIX}/pois/:id`, async (req, reply) => {
    const id = parseIdParam(req.params);
    const deleted = await db
      .delete(pointsOfInterest)
      .where(eq(pointsOfInterest.id, id))
      .returning({ id: pointsOfInterest.id });
    if (deleted.length === 0) throw notFound('Point of interest', id);
    return reply.code(204).send();
  });
}
