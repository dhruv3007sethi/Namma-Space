import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './helpers.js';

let t: TestApp;
let spaceA: string;
let spaceB: string;
let projectId: string;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());
beforeEach(async () => {
  await t.reset();
  projectId = (
    await t.app.inject({ method: 'POST', url: '/api/v1/projects', payload: { name: 'Office' } })
  ).json().data.id;
  const mk = async (name: string) =>
    (
      await t.app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projectId}/spaces`,
        payload: { name },
      })
    ).json().data.id as string;
  spaceA = await mk('Lobby');
  spaceB = await mk('Pantry');
});

const addPoi = (spaceId: string, body: object) =>
  t.app.inject({ method: 'POST', url: `/api/v1/spaces/${spaceId}/pois`, payload: body });

describe('points of interest', () => {
  it('creates manual POIs and searches them', async () => {
    const created = await addPoi(spaceA, {
      name: 'Reception desk',
      category: 'furniture',
      position: { x: 1, y: 0, z: 2.5 },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({
      source: 'manual',
      position: { x: 1, y: 0, z: 2.5 },
    });

    await addPoi(spaceA, {
      name: 'Main entrance',
      category: 'door',
      position: { x: 0, y: 0, z: 0 },
    });
    await addPoi(spaceB, {
      name: 'Coffee machine',
      description: 'Near the window',
      category: 'appliance',
      position: { x: 3, y: 1, z: 1 },
    });

    const search = (qs: string) => t.app.inject(`/api/v1/pois/search?${qs}`);

    expect((await search('q=desk')).json().data.map((p: { name: string }) => p.name)).toEqual([
      'Reception desk',
    ]);
    // Description matches too, case-insensitively.
    expect((await search('q=WINDOW')).json().data).toHaveLength(1);
    expect((await search('category=door')).json().data).toHaveLength(1);
    expect((await search(`spaceId=${spaceA}`)).json().data).toHaveLength(2);
    expect((await search(`projectId=${projectId}&limit=2`)).json().data).toHaveLength(2);
    // LIKE wildcards are escaped.
    expect((await search('q=%25')).json().data).toHaveLength(0);
    expect((await search('category=spaceship')).statusCode).toBe(400);
  });

  it('updates and deletes POIs', async () => {
    const poi = (
      await addPoi(spaceA, { name: 'Exit', category: 'exit', position: { x: 0, y: 0, z: 0 } })
    ).json().data;
    const patched = await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/pois/${poi.id}`,
      payload: { position: { x: 5, y: 0, z: 5 } },
    });
    expect(patched.json().data.position).toEqual({ x: 5, y: 0, z: 5 });
    const del = await t.app.inject({ method: 'DELETE', url: `/api/v1/pois/${poi.id}` });
    expect(del.statusCode).toBe(204);
    const list = await t.app.inject(`/api/v1/spaces/${spaceA}/pois`);
    expect(list.json().data).toHaveLength(0);
  });
});
