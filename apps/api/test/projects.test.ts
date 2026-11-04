import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const createProject = async (body: object) =>
  t.app.inject({ method: 'POST', url: '/api/v1/projects', payload: body });

describe('health & capabilities', () => {
  it('reports healthy dependencies', async () => {
    const res = await t.app.inject('/health');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', checks: { database: 'ok', storage: 'ok' } });
  });

  it('reports AI integrations as not configured', async () => {
    const res = await t.app.inject('/api/v1/capabilities');
    const { data } = res.json();
    expect(data.reconstructionProviders.length).toBeGreaterThan(0);
    expect(data.reconstructionProviders.every((p: { configured: boolean }) => !p.configured)).toBe(
      true,
    );
    expect(data.visionProviders.every((p: { configured: boolean }) => !p.configured)).toBe(true);
    expect(data.acceptedMimeTypes).toContain('image/jpeg');
  });

  it('returns a structured 404 for unknown routes', async () => {
    const res = await t.app.inject('/api/v1/nope');
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('projects', () => {
  it('creates, lists, reads, updates and deletes a project', async () => {
    const created = await createProject({ name: 'Head Office', description: 'Bengaluru HQ' });
    expect(created.statusCode).toBe(201);
    const project = created.json().data;
    expect(project).toMatchObject({
      name: 'Head Office',
      description: 'Bengaluru HQ',
      spaceCount: 0,
    });

    const list = await t.app.inject('/api/v1/projects');
    expect(list.json().data).toHaveLength(1);

    const patched = await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}`,
      payload: { name: 'HQ', description: null },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().data).toMatchObject({ name: 'HQ', description: null });

    const del = await t.app.inject({ method: 'DELETE', url: `/api/v1/projects/${project.id}` });
    expect(del.statusCode).toBe(204);
    const gone = await t.app.inject(`/api/v1/projects/${project.id}`);
    expect(gone.statusCode).toBe(404);
  });

  it('rejects invalid input with validation details', async () => {
    const res = await createProject({ name: '' });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details[0].path).toBe('name');
  });

  it('rejects malformed ids', async () => {
    const res = await t.app.inject('/api/v1/projects/not-a-uuid');
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 for a missing project', async () => {
    const res = await t.app.inject('/api/v1/projects/00000000-0000-4000-8000-000000000000');
    expect(res.statusCode).toBe(404);
  });
});

describe('spaces', () => {
  it('manages spaces within a project and tracks counts', async () => {
    const project = (await createProject({ name: 'Mall' })).json().data;
    const created = await t.app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/spaces`,
      payload: { name: 'Food court', spaceType: 'floor', floorLevel: 2 },
    });
    expect(created.statusCode).toBe(201);
    const space = created.json().data;
    expect(space).toMatchObject({
      name: 'Food court',
      spaceType: 'floor',
      floorLevel: 2,
      mediaCount: 0,
    });

    const projectAfter = (await t.app.inject(`/api/v1/projects/${project.id}`)).json().data;
    expect(projectAfter.spaceCount).toBe(1);

    const list = await t.app.inject(`/api/v1/projects/${project.id}/spaces`);
    expect(list.json().data).toHaveLength(1);

    const patched = await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/spaces/${space.id}`,
      payload: { floorLevel: null, spaceType: 'room' },
    });
    expect(patched.json().data).toMatchObject({ floorLevel: null, spaceType: 'room' });

    const del = await t.app.inject({ method: 'DELETE', url: `/api/v1/spaces/${space.id}` });
    expect(del.statusCode).toBe(204);
  });

  it('404s when the parent project does not exist', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/v1/projects/00000000-0000-4000-8000-000000000000/spaces',
      payload: { name: 'Orphan' },
    });
    expect(res.statusCode).toBe(404);
  });
});
