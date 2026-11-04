import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { ReconstructionProvider } from '../src/providers/types.js';
import { createTestApp, fixtures, multipart, type TestApp } from './helpers.js';

const apps: TestApp[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});
afterAll(async () => {
  await Promise.all(apps.map((a) => a.close()));
});

async function setup(providers?: ReconstructionProvider[]) {
  const t = await createTestApp(
    providers ? { providers: { reconstruction: providers, vision: [] } } : {},
  );
  apps.push(t);
  await t.reset();
  const projectId = (
    await t.app.inject({ method: 'POST', url: '/api/v1/projects', payload: { name: 'P' } })
  ).json().data.id;
  const spaceId = (
    await t.app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/spaces`,
      payload: { name: 'Room' },
    })
  ).json().data.id as string;
  return { t, spaceId };
}

const uploadPhoto = (t: TestApp, spaceId: string) =>
  t.app.inject({
    method: 'POST',
    url: `/api/v1/spaces/${spaceId}/media`,
    ...multipart([{ filename: 'r.jpg', contentType: 'image/jpeg', data: fixtures.jpeg() }]),
  });

describe('reconstructions', () => {
  it('refuses to reconstruct when no provider is configured', async () => {
    const { t, spaceId } = await setup();
    await uploadPhoto(t, spaceId);
    const res = await t.app.inject({
      method: 'POST',
      url: `/api/v1/spaces/${spaceId}/reconstructions`,
      payload: {},
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('PROVIDER_NOT_CONFIGURED');
    const list = await t.app.inject(`/api/v1/spaces/${spaceId}/reconstructions`);
    expect(list.json().data).toEqual([]);
  });

  it('submits media to a configured provider and tracks its status', async () => {
    // Test double standing in for a real external adapter.
    const received: string[] = [];
    let remoteStatus: 'processing' | 'succeeded' = 'processing';
    const provider: ReconstructionProvider = {
      id: 'test-provider',
      label: 'Test provider',
      async submit(input) {
        for (const m of input.media) {
          const stream = await m.open();
          const chunks: Buffer[] = [];
          for await (const c of stream) chunks.push(c as Buffer);
          received.push(`${m.filename}:${Buffer.concat(chunks).length}`);
        }
        return { externalJobId: 'ext-123' };
      },
      async getStatus() {
        return { status: remoteStatus };
      },
    };
    const { t, spaceId } = await setup([provider]);

    const empty = await t.app.inject({
      method: 'POST',
      url: `/api/v1/spaces/${spaceId}/reconstructions`,
      payload: {},
    });
    expect(empty.statusCode).toBe(400);

    await uploadPhoto(t, spaceId);
    const res = await t.app.inject({
      method: 'POST',
      url: `/api/v1/spaces/${spaceId}/reconstructions`,
      payload: {},
    });
    expect(res.statusCode).toBe(202);
    const job = res.json().data;
    expect(job).toMatchObject({
      provider: 'test-provider',
      status: 'processing',
      externalJobId: 'ext-123',
    });
    expect(received).toEqual(['r.jpg:256']);

    remoteStatus = 'succeeded';
    const refreshed = await t.app.inject(`/api/v1/reconstructions/${job.id}`);
    expect(refreshed.json().data.status).toBe('succeeded');

    const caps = (await t.app.inject('/api/v1/capabilities')).json().data;
    expect(caps.reconstructionProviders).toContainEqual({
      id: 'test-provider',
      label: 'Test provider',
      configured: true,
    });
  });

  it('records provider submission failures on the job', async () => {
    const provider: ReconstructionProvider = {
      id: 'flaky',
      label: 'Flaky',
      submit: async () => {
        throw new Error('upstream 500');
      },
      getStatus: async () => ({ status: 'failed' }),
    };
    const { t, spaceId } = await setup([provider]);
    await uploadPhoto(t, spaceId);
    const res = await t.app.inject({
      method: 'POST',
      url: `/api/v1/spaces/${spaceId}/reconstructions`,
      payload: {},
    });
    expect(res.json().data).toMatchObject({ status: 'failed', errorMessage: 'upstream 500' });
  });
});
